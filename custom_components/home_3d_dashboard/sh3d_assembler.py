"""Sweet Home 3D assembler - combines all objects into one OBJ."""
import zipfile
import os
import math
import shutil
import logging
import xml.etree.ElementTree as ET

_LOGGER = logging.getLogger(__name__)


def assemble_sh3d(zip_path, output_dir):
    """Parse .sh3d ZIP archive and assemble all objects."""
    ed = os.path.join(output_dir, "_extracted")
    if os.path.exists(ed):
        shutil.rmtree(ed)
    os.makedirs(ed, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(ed)

    xml_path = os.path.join(ed, "Home.xml")
    if not os.path.exists(xml_path):
        _LOGGER.error("No Home.xml found in archive")
        return None

    tree = ET.parse(xml_path)
    root = tree.getroot()

    items = []
    tags = [
        "pieceOfFurniture",
        "doorOrWindow",
        "light",
    ]
    for tag in tags:
        for elem in root.iter(tag):
            model = elem.get("model")
            if not model:
                continue
            items.append({
                "name": elem.get("name", "unnamed"),
                "model": model,
                "x": float(elem.get("x", 0)),
                "y": float(elem.get("y", 0)),
                "elevation": float(
                    elem.get("elevation", 0)
                ),
                "angle": float(
                    elem.get("angle", 0)
                ),
                "width": float(
                    elem.get("width", 100)
                ),
                "depth": float(
                    elem.get("depth", 100)
                ),
                "height": float(
                    elem.get("height", 100)
                ),
                "mirrored": (
                    elem.get("modelMirrored")
                    == "true"
                ),
                "tag": tag,
            })

    walls = []
    wh_def = float(
        root.get("wallHeight", 250)
    )
    for elem in root.iter("wall"):
        walls.append({
            "xs": float(elem.get("xStart", 0)),
            "ys": float(elem.get("yStart", 0)),
            "xe": float(elem.get("xEnd", 0)),
            "ye": float(elem.get("yEnd", 0)),
            "h": float(
                elem.get("height", wh_def)
            ),
            "t": float(
                elem.get("thickness", 7.5)
            ),
        })

    _LOGGER.info(
        "Found %d items, %d walls",
        len(items), len(walls),
    )

    def parse_obj(path):
        """Parse an OBJ file into components."""
        verts = []
        norms = []
        texcs = []
        faces = []
        if not os.path.exists(path):
            return None
        with open(path, 'r', errors='ignore') as f:
            for line in f:
                p = line.strip().split()
                if not p:
                    continue
                if p[0] == 'v' and len(p) >= 4:
                    verts.append([
                        float(p[1]),
                        float(p[2]),
                        float(p[3]),
                    ])
                elif p[0] == 'vn' and len(p) >= 4:
                    norms.append([
                        float(p[1]),
                        float(p[2]),
                        float(p[3]),
                    ])
                elif p[0] == 'vt' and len(p) >= 3:
                    texcs.append([
                        float(p[1]),
                        float(p[2]),
                    ])
                elif p[0] == 'f':
                    face = []
                    for fp in p[1:]:
                        idx = fp.split('/')
                        vi = int(idx[0]) if idx[0] else 0
                        ti = 0
                        ni = 0
                        if len(idx) > 1 and idx[1]:
                            ti = int(idx[1])
                        if len(idx) > 2 and idx[2]:
                            ni = int(idx[2])
                        face.append((vi, ti, ni))
                    faces.append(face)
        if not verts:
            return None
        return {
            "v": verts,
            "vn": norms,
            "vt": texcs,
            "f": faces,
        }

    out = ["# Assembled from Sweet Home 3D\n"]
    vo = 0
    vto = 0
    vno = 0
    oc = 0
    name_counts = {}

    def make_unique(raw_name):
        """Generate a unique group name."""
        safe = raw_name.replace(' ', '_')
        safe = safe.replace('/', '_')
        safe = safe.replace('\\', '_')
        if safe not in name_counts:
            name_counts[safe] = 0
            return safe
        name_counts[safe] += 1
        return f"{safe}_{name_counts[safe]}"

    def resolve(model_ref):
        """Resolve a model reference to a file path."""
        if '/' in model_ref:
            if model_ref.endswith('.obj'):
                return os.path.join(
                    ed, model_ref
                )
        p = os.path.join(ed, model_ref)
        if os.path.isfile(p):
            try:
                with open(
                    p, 'r', errors='ignore'
                ) as f:
                    first = f.read(300)
                if 'v ' in first:
                    return p
                if first.startswith('#'):
                    return p
            except Exception:
                pass
        obj_p = p + '.obj'
        if os.path.isfile(obj_p):
            return obj_p
        return None

    for item in items:
        mp = resolve(item["model"])
        if not mp:
            _LOGGER.debug(
                "Skip %s: no OBJ",
                item["name"],
            )
            continue
        obj = parse_obj(mp)
        if not obj:
            continue

        verts = [v[:] for v in obj["v"]]
        mins = [
            min(v[i] for v in verts)
            for i in range(3)
        ]
        maxs = [
            max(v[i] for v in verts)
            for i in range(3)
        ]
        rw = maxs[0] - mins[0] or 1
        rh = maxs[1] - mins[1] or 1
        rd = maxs[2] - mins[2] or 1

        tw = item["width"]
        td = item["depth"]
        th = item["height"]
        sx = tw / rw
        sy = th / rh
        sz = td / rd

        cx = (mins[0] + maxs[0]) / 2
        cy = mins[1]
        cz = (mins[2] + maxs[2]) / 2

        ang = item["angle"]
        ca = math.cos(ang)
        sa = math.sin(ang)
        mir = -1 if item["mirrored"] else 1

        px = item["x"] / 100.0
        py = item["elevation"] / 100.0
        pz = item["y"] / 100.0

        for v in verts:
            v[0] = (v[0] - cx) * sx * mir
            v[1] = (v[1] - cy) * sy
            v[2] = (v[2] - cz) * sz
            rx = ca * v[0] + sa * v[2]
            rz = -sa * v[0] + ca * v[2]
            v[0] = rx + px
            v[1] = v[1] + py
            v[2] = rz + pz

        gname = make_unique(item["name"])
        out.append(f"g {gname}\n")

        for v in verts:
            out.append(
                f"v {v[0]:.4f}"
                f" {v[1]:.4f}"
                f" {v[2]:.4f}\n"
            )
        for vt in obj["vt"]:
            out.append(
                f"vt {vt[0]:.4f}"
                f" {vt[1]:.4f}\n"
            )
        for vn in obj["vn"]:
            out.append(
                f"vn {vn[0]:.4f}"
                f" {vn[1]:.4f}"
                f" {vn[2]:.4f}\n"
            )

        for face in obj["f"]:
            parts = []
            for vi, ti, ni in face:
                vi2 = vi + vo if vi > 0 else vi - vo
                ti2 = ti + vto if ti > 0 else 0
                ni2 = ni + vno if ni > 0 else 0
                if ti2 and ni2:
                    parts.append(
                        f"{vi2}/{ti2}/{ni2}"
                    )
                elif ti2:
                    parts.append(
                        f"{vi2}/{ti2}"
                    )
                elif ni2:
                    parts.append(
                        f"{vi2}//{ni2}"
                    )
                else:
                    parts.append(f"{vi2}")
            out.append(
                "f " + " ".join(parts) + "\n"
            )

        vo += len(obj["v"])
        vto += len(obj["vt"])
        vno += len(obj["vn"])
        oc += 1
        _LOGGER.debug(
            "Added %s (%d verts)",
            gname, len(obj["v"]),
        )

    wi = 0
    for w in walls:
        xs = w["xs"] / 100
        ys = w["ys"] / 100
        xe = w["xe"] / 100
        ye = w["ye"] / 100
        h = w["h"] / 100
        t = w["t"] / 100
        dx = xe - xs
        dy = ye - ys
        length = math.sqrt(dx * dx + dy * dy)
        if length < 0.001:
            continue
        nx = -dy / length * t / 2
        ny = dx / length * t / 2
        wv = [
            (xs - nx, 0, ys - ny),
            (xs + nx, 0, ys + ny),
            (xe + nx, 0, ye + ny),
            (xe - nx, 0, ye - ny),
            (xs - nx, h, ys - ny),
            (xs + nx, h, ys + ny),
            (xe + nx, h, ye + ny),
            (xe - nx, h, ye - ny),
        ]
        out.append(f"g Wall_{wi}\n")
        out.append("usemtl wall_material\n")
        for v in wv:
            out.append(
                f"v {v[0]:.4f}"
                f" {v[1]:.4f}"
                f" {v[2]:.4f}\n"
            )
        b = vo + 1
        wall_faces = [
            (0, 1, 5, 4),
            (2, 3, 7, 6),
            (4, 5, 6, 7),
            (0, 3, 2, 1),
            (0, 4, 7, 3),
            (1, 2, 6, 5),
        ]
        for face in wall_faces:
            out.append(
                f"f {b+face[0]}"
                f" {b+face[1]}"
                f" {b+face[2]}"
                f" {b+face[3]}\n"
            )
        vo += 8
        wi += 1

    _LOGGER.info(
        "Assembly: %d objs, %d walls, %d lines",
        oc, wi, len(out),
    )

    op = os.path.join(
        output_dir, "assembled.obj"
    )
    with open(op, 'w') as f:
        f.writelines(out)

    mp = os.path.join(
        output_dir, "assembled.mtl"
    )
    with open(mp, 'w') as f:
        f.write(
            "newmtl wall_material\n"
            "Kd 0.85 0.85 0.82\n"
            "Ka 0.3 0.3 0.3\n"
        )

    _LOGGER.info("Wrote %s", op)
    return op


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.DEBUG)
    r = assemble_sh3d(sys.argv[1], sys.argv[2])
    print(f"Result: {r}")
