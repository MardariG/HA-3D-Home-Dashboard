"""Sweet Home 3D assembler v3 - materials, textures, modelRotation."""
import zipfile
import zlib
import struct
import os
import math
import shutil
import logging
import xml.etree.ElementTree as ET

_LOGGER = logging.getLogger(__name__)

# Built-in Sweet Home 3D material color palette
_SH3D_COLORS = {
    "white": (0.95, 0.95, 0.95),
    "white.001": (0.95, 0.95, 0.95),
    "flwhite": (0.92, 0.92, 0.92),
    "flwhite1": (0.90, 0.90, 0.90),
    "archwhite": (0.88, 0.87, 0.85),
    "archwhite2": (0.85, 0.84, 0.82),
    "silver": (0.78, 0.78, 0.78),
    "ltgrey": (0.70, 0.70, 0.70),
    "flltgrey": (0.65, 0.65, 0.65),
    "flgrey": (0.55, 0.55, 0.55),
    "dkgrey": (0.40, 0.40, 0.40),
    "fldkgrey": (0.35, 0.35, 0.35),
    "dkdkgrey": (0.25, 0.25, 0.25),
    "fldkdkgrey": (0.20, 0.20, 0.20),
    "flblack": (0.10, 0.10, 0.10),
    "black": (0.05, 0.05, 0.05),
    "bone": (0.89, 0.86, 0.79),
    "lighttan": (0.85, 0.78, 0.65),
    "sand_stone": (0.82, 0.76, 0.62),
    "flltbrown": (0.60, 0.45, 0.30),
    "red": (0.75, 0.15, 0.15),
    "brzskin": (0.72, 0.55, 0.42),
    "blondhair": (0.85, 0.75, 0.55),
}




def _manual_extract(zip_path, dest_dir):
    """Extract SH3D ZIP handling Java-serialized Home entry."""
    os.makedirs(dest_dir, exist_ok=True)
    with open(zip_path, 'rb') as f:
        data = f.read()

    # Try standard zipfile first
    try:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(dest_dir)
            _LOGGER.info("Standard ZIP extraction OK")
            return True
    except Exception:
        _LOGGER.info("Standard ZIP failed, using manual extraction")

    # Find all PK local file headers
    entries = []
    pos = 0
    while True:
        idx = data.find(b'PK\x03\x04', pos)
        if idx == -1:
            break
        fnlen = struct.unpack('<H', data[idx+26:idx+28])[0]
        exlen = struct.unpack('<H', data[idx+28:idx+30])[0]
        method = struct.unpack('<H', data[idx+8:idx+10])[0]
        fname = data[idx+30:idx+30+fnlen].decode(
            'utf-8', errors='replace'
        )
        dstart = idx + 30 + fnlen + exlen
        entries.append((idx, fname, dstart, method))
        pos = idx + 1

    for i, (off, fname, ds, method) in enumerate(entries):
        if fname.endswith('/') or fname == 'Home':
            # Directory entry or Java serialized Home
            if fname.endswith('/'):
                dp = os.path.join(dest_dir, fname)
                os.makedirs(dp, exist_ok=True)
            continue
        # Compute data end = next entry start
        nxt = (
            entries[i+1][0]
            if i+1 < len(entries)
            else len(data)
        )
        raw_chunk = data[ds:nxt]
        out_path = os.path.join(dest_dir, fname)
        out_dir = os.path.dirname(out_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        if method == 0:
            # Stored
            comp_size = struct.unpack(
                '<I', data[off+18:off+22]
            )[0]
            with open(out_path, 'wb') as fp:
                fp.write(data[ds:ds+comp_size])
        elif method == 8:
            # Deflate - try multiple trims for data descriptor
            extracted = False
            for trim in [0, 12, 16, 24]:
                try:
                    cd = (
                        raw_chunk[:len(raw_chunk)-trim]
                        if trim
                        else raw_chunk
                    )
                    result = zlib.decompress(cd, -15)
                    with open(out_path, 'wb') as fp:
                        fp.write(result)
                    extracted = True
                    break
                except Exception:
                    continue
            if not extracted:
                _LOGGER.debug("Skip %s: decompress fail", fname)
        else:
            _LOGGER.debug("Skip %s: method %d", fname, method)

    _LOGGER.info("Extracted %d entries", len(entries))
    return True


def assemble_sh3d(zip_path, output_dir):
    """Parse .sh3d ZIP and assemble all objects with materials."""
    ed = os.path.join(output_dir, "_extracted")
    if os.path.exists(ed):
        shutil.rmtree(ed)

    _manual_extract(zip_path, ed)

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
            # Parse modelRotation matrix (3x3)
            mr_str = elem.get("modelRotation", "")
            mr = None
            if mr_str:
                parts = mr_str.strip().split()
                if len(parts) == 9:
                    mr = [float(p) for p in parts]

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
                "modelRotation": mr,
                "color": elem.get("color"),
                "shininess": elem.get("shininess"),
                "tag": tag,
            })

    walls = []
    wh_def = float(root.get("wallHeight", 250))
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
            "leftColor": elem.get(
                "leftSideColor"
            ),
            "rightColor": elem.get(
                "rightSideColor"
            ),
            "topColor": elem.get("topColor"),
        })

    _LOGGER.info(
        "Found %d items, %d walls",
        len(items), len(walls),
    )

    # ------ Helpers ------
    def parse_obj(path):
        """Parse OBJ file into components."""
        verts = []
        norms = []
        texcs = []
        faces = []
        mtl_file = None
        cur_mtl = None
        cur_group = None
        window_pane_groups = set()
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
                    faces.append((cur_mtl, face))
                    # Track which materials belong
                    # to window pane groups
                    if cur_group and cur_group in window_pane_groups and cur_mtl:
                        window_pane_groups.add(
                            "mtl:" + cur_mtl
                        )
                elif p[0] == 'g' or p[0] == 'o':
                    cur_group = ' '.join(p[1:])
                    if cur_group.startswith(
                        "sweethome3d_window_pane"
                    ):
                        window_pane_groups.add(
                            cur_group
                        )
                elif p[0] == 'mtllib':
                    mtl_file = ' '.join(p[1:])
                elif p[0] == 'usemtl':
                    cur_mtl = ' '.join(p[1:])
        if not verts:
            return None
        # Extract material names that are window panes
        pane_materials = set()
        for item in window_pane_groups:
            if item.startswith("mtl:"):
                pane_materials.add(item[4:])
        return {
            "v": verts,
            "vn": norms,
            "vt": texcs,
            "f": faces,
            "mtl_file": mtl_file,
            "pane_materials": pane_materials,
        }

    def parse_mtl(path):
        """Parse MTL file into material dict."""
        materials = {}
        cur = None
        if not os.path.exists(path):
            return materials
        with open(path, 'r', errors='ignore') as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith('#'):
                    continue
                p = s.split()
                if p[0] == 'newmtl':
                    cur = ' '.join(p[1:])
                    materials[cur] = []
                elif cur is not None:
                    materials[cur].append(s)
        return materials

    def resolve_model(model_ref):
        """Resolve model reference to OBJ path."""
        # Direct path with slash (folder/name.obj)
        if '/' in model_ref:
            p = os.path.join(ed, model_ref)
            if os.path.isfile(p):
                return p
            return None
        # Numbered reference - check if it's a directory
        dp = os.path.join(ed, model_ref)
        if os.path.isdir(dp):
            # Find .obj inside
            for fn in os.listdir(dp):
                if fn.lower().endswith('.obj'):
                    return os.path.join(dp, fn)
            return None
        # Plain file (standalone OBJ embedded as number)
        if os.path.isfile(dp):
            try:
                with open(dp, 'r', errors='ignore') as f:
                    first = f.read(500)
                if 'v ' in first or first.startswith('#'):
                    return dp
            except Exception:
                pass
        return None

    def resolve_mtl(obj_path, mtl_ref):
        """Resolve MTL path relative to OBJ."""
        if not mtl_ref:
            return None
        obj_dir = os.path.dirname(obj_path)
        mp = os.path.join(obj_dir, mtl_ref)
        if os.path.isfile(mp):
            return mp
        return None

    # ------ Assembly ------
    out_lines = ["# Assembled from Sweet Home 3D\n"]
    out_lines.append("mtllib assembled.mtl\n\n")
    all_materials = {}  # prefix -> {name: lines}
    texture_files = []  # (src, dest_name)
    vo = 0
    vto = 0
    vno = 0
    oc = 0
    name_counts = {}

    def make_unique(raw_name):
        safe = raw_name.replace(' ', '_')
        safe = safe.replace('/', '_')
        safe = safe.replace('\\', '_')
        if safe not in name_counts:
            name_counts[safe] = 0
            return safe
        name_counts[safe] += 1
        return f"{safe}_{name_counts[safe]}"

    for item in items:
        obj_path = resolve_model(item["model"])
        if not obj_path:
            _LOGGER.debug(
                "Skip %s: no OBJ", item["name"]
            )
            continue
        obj = parse_obj(obj_path)
        if not obj:
            continue

        gname = make_unique(item["name"])
        prefix = gname + "__"

        # --- Materials ---
        mtl_map = {}  # old_name -> new_name
        if obj["mtl_file"]:
            mtl_path = resolve_mtl(
                obj_path, obj["mtl_file"]
            )
            if mtl_path:
                mats = parse_mtl(mtl_path)
                mtl_dir = os.path.dirname(mtl_path)
                for mname, mlines in mats.items():
                    new_name = prefix + mname
                    mtl_map[mname] = new_name
                    # Process lines, fix texture paths
                    new_lines = []
                    for ml in mlines:
                        parts = ml.split()
                        if (
                            len(parts) >= 2
                            and parts[0] in (
                                'map_Kd', 'map_Ka',
                                'map_Ks', 'map_Ns',
                                'map_d', 'map_bump',
                                'bump', 'disp',
                            )
                        ):
                            tex_ref = ' '.join(parts[1:])
                            tex_src = os.path.join(
                                mtl_dir, tex_ref
                            )
                            if os.path.isfile(tex_src):
                                # Unique texture name
                                tex_dest = (
                                    gname + "_"
                                    + os.path.basename(tex_ref)
                                )
                                texture_files.append(
                                    (tex_src, tex_dest)
                                )
                                new_lines.append(
                                    f"{parts[0]} {tex_dest}"
                                )
                            else:
                                new_lines.append(ml)
                        else:
                            new_lines.append(ml)
                    all_materials[new_name] = new_lines

        # Handle standalone OBJ materials (no mtllib but has usemtl)
        if not obj["mtl_file"] and not mtl_map:
            seen_mtls = set()
            for face_mtl, _ in obj["f"]:
                if face_mtl:
                    seen_mtls.add(face_mtl)
            for sm in seen_mtls:
                new_name = prefix + sm
                mtl_map[sm] = new_name
                rgb = _SH3D_COLORS.get(
                    sm, (0.7, 0.7, 0.7)
                )
                mat_lines = [
                    f"Ka 0.2 0.2 0.2",
                    f"Kd {rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f}",
                    f"Ks 0.1 0.1 0.1",
                    f"Ns 20",
                    f"illum 2",
                ]
                all_materials[new_name] = mat_lines

        # Override color from XML if set
        xml_color = item.get("color")
        if xml_color and not mtl_map:
            # No MTL but has XML color - create material
            try:
                ci = int(xml_color)
                r = ((ci >> 16) & 0xFF) / 255.0
                g = ((ci >> 8) & 0xFF) / 255.0
                b = (ci & 0xFF) / 255.0
                mname = prefix + "xmlcolor"
                all_materials[mname] = [
                    f"Ka 0.2 0.2 0.2",
                    f"Kd {r:.4f} {g:.4f} {b:.4f}",
                    f"Ks 0.1 0.1 0.1",
                    f"Ns 30",
                    f"illum 2",
                ]
                mtl_map["__default__"] = mname
            except Exception:
                pass

        # --- Window pane transparency ---
        pane_mats = obj.get("pane_materials", set())
        if pane_mats:
            for orig_name in pane_mats:
                mapped = mtl_map.get(orig_name)
                if mapped and mapped in all_materials:
                    mlines = all_materials[mapped]
                    has_d = any(
                        ln.strip().startswith('d ')
                        for ln in mlines
                    )
                    if not has_d:
                        mlines.append("d 0.5")
                    _LOGGER.debug(
                        "Window pane: %s -> %s",
                        orig_name, mapped,
                    )

        # --- Geometry transforms ---
        verts = [v[:] for v in obj["v"]]

        # Apply modelRotation matrix first (if present)
        mr = item["modelRotation"]
        if mr:
            for v in verts:
                x0, y0, z0 = v
                v[0] = mr[0]*x0 + mr[1]*y0 + mr[2]*z0
                v[1] = mr[3]*x0 + mr[4]*y0 + mr[5]*z0
                v[2] = mr[6]*x0 + mr[7]*y0 + mr[8]*z0

        # Compute bounding box after modelRotation
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

        tw = item["width"] / 100.0
        td = item["depth"] / 100.0
        th = item["height"] / 100.0
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

        # Also transform normals if modelRotation
        norms = [n[:] for n in obj["vn"]]
        if mr:
            for n in norms:
                x0, y0, z0 = n
                n[0] = mr[0]*x0 + mr[1]*y0 + mr[2]*z0
                n[1] = mr[3]*x0 + mr[4]*y0 + mr[5]*z0
                n[2] = mr[6]*x0 + mr[7]*y0 + mr[8]*z0
        # Rotate normals by angle
        if abs(ang) > 0.001:
            for n in norms:
                nx = ca * n[0] + sa * n[2]
                nz = -sa * n[0] + ca * n[2]
                n[0] = nx
                n[2] = nz

        # --- Write geometry ---
        out_lines.append(f"g {gname}\n")

        # Set default material if XML color override
        if "__default__" in mtl_map:
            out_lines.append(
                f"usemtl {mtl_map['__default__']}\n"
            )

        for v in verts:
            out_lines.append(
                f"v {v[0]:.4f}"
                f" {v[1]:.4f}"
                f" {v[2]:.4f}\n"
            )
        for vt in obj["vt"]:
            out_lines.append(
                f"vt {vt[0]:.4f}"
                f" {vt[1]:.4f}\n"
            )
        for n in norms:
            out_lines.append(
                f"vn {n[0]:.4f}"
                f" {n[1]:.4f}"
                f" {n[2]:.4f}\n"
            )

        cur_face_mtl = None
        for face_mtl, face in obj["f"]:
            if face_mtl != cur_face_mtl:
                cur_face_mtl = face_mtl
                if face_mtl and face_mtl in mtl_map:
                    out_lines.append(
                        f"usemtl {mtl_map[face_mtl]}\n"
                    )
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
                    parts.append(f"{vi2}/{ti2}")
                elif ni2:
                    parts.append(f"{vi2}//{ni2}")
                else:
                    parts.append(f"{vi2}")
            out_lines.append(
                "f " + " ".join(parts) + "\n"
            )

        vo += len(obj["v"])
        vto += len(obj["vt"])
        vno += len(obj["vn"])
        oc += 1
        _LOGGER.debug(
            "Added %s (%d verts, %d mats)",
            gname, len(obj["v"]), len(mtl_map),
        )

    # --- Walls with door/window cutouts ---
    wi = 0
    wall_mtl_name = "wall_material"
    all_materials[wall_mtl_name] = [
        "Ka 0.3 0.3 0.3",
        "Kd 0.85 0.85 0.82",
        "Ks 0.05 0.05 0.05",
        "Ns 10",
        "illum 2",
    ]

    def _color_to_mtl(color_str, mtl_name):
        """Convert SH3D integer color to MTL material."""
        try:
            ci = int(color_str)
            r = ((ci >> 16) & 0xFF) / 255.0
            g = ((ci >> 8) & 0xFF) / 255.0
            b = (ci & 0xFF) / 255.0
            all_materials[mtl_name] = [
                f"Ka {r*0.3:.4f} {g*0.3:.4f} {b*0.3:.4f}",
                f"Kd {r:.4f} {g:.4f} {b:.4f}",
                "Ks 0.05 0.05 0.05",
                "Ns 10",
                "illum 2",
            ]
            return True
        except (ValueError, TypeError):
            return False

    # Collect door/window openings (in cm)
    openings = []
    for item in items:
        if item["tag"] == "doorOrWindow":
            openings.append({
                "x": item["x"],
                "y": item["y"],
                "width": item["width"],
                "depth": item["depth"],
                "height": item["height"],
                "elevation": item["elevation"],
                "angle": item["angle"],
            })

    def _point_to_segment_dist(px, py, x1, y1, x2, y2):
        """Distance from point to line segment, plus projection t."""
        dx = x2 - x1
        dy = y2 - y1
        l2 = dx * dx + dy * dy
        if l2 < 0.0001:
            return math.sqrt((px-x1)**2 + (py-y1)**2), 0.0
        t = ((px - x1) * dx + (py - y1) * dy) / l2
        t = max(0, min(1, t))
        cx = x1 + t * dx
        cy = y1 + t * dy
        return math.sqrt((px-cx)**2 + (py-cy)**2), t

    def _wall_face_with_holes(x0, z0, x1, z1, h,
                              holes, vo_start):
        """Generate a rectangular wall face with holes.
        Face goes from (x0,0,z0) to (x1,h,z1).
        holes: list of (t_start, t_end, y_bot, y_top)
        in wall-local coords (t along wall, y vertical).
        Returns (vertices, faces) where faces ref vo_start.
        """
        verts = []
        faces = []
        length = math.sqrt((x1-x0)**2 + (z1-z0)**2)
        if length < 0.001:
            return verts, faces
        dx = (x1 - x0) / length
        dz = (z1 - z0) / length

        # Sort holes by t_start
        holes = sorted(holes, key=lambda h: h[0])

        # Clamp holes to wall bounds
        clamped = []
        for ts, te, yb, yt in holes:
            ts = max(0, ts)
            te = min(length, te)
            yb = max(0, yb)
            yt = min(h, yt)
            if te > ts and yt > yb:
                clamped.append((ts, te, yb, yt))
        holes = clamped

        # Build vertical strips along the wall
        # Collect all t-boundaries
        t_bounds = [0.0]
        for ts, te, yb, yt in holes:
            t_bounds.append(ts)
            t_bounds.append(te)
        t_bounds.append(length)
        t_bounds = sorted(set(t_bounds))

        def _add_quad(t_l, t_r, y_b, y_t):
            """Add a quad from t_l..t_r, y_b..y_t."""
            if t_r - t_l < 0.0001 or y_t - y_b < 0.0001:
                return
            idx = len(verts)
            verts.append((
                x0 + dx * t_l, y_b, z0 + dz * t_l
            ))
            verts.append((
                x0 + dx * t_r, y_b, z0 + dz * t_r
            ))
            verts.append((
                x0 + dx * t_r, y_t, z0 + dz * t_r
            ))
            verts.append((
                x0 + dx * t_l, y_t, z0 + dz * t_l
            ))
            b = vo_start + idx + 1
            faces.append((b, b+1, b+2, b+3))

        for si in range(len(t_bounds) - 1):
            tl = t_bounds[si]
            tr = t_bounds[si + 1]
            if tr - tl < 0.0001:
                continue
            # Find holes that overlap this strip
            strip_holes = []
            for ts, te, yb, yt in holes:
                if ts <= tl + 0.001 and te >= tr - 0.001:
                    strip_holes.append((yb, yt))
            if not strip_holes:
                _add_quad(tl, tr, 0, h)
            else:
                # Sort holes by bottom
                strip_holes.sort(key=lambda s: s[0])
                y_cur = 0
                for yb, yt in strip_holes:
                    if yb > y_cur + 0.001:
                        _add_quad(tl, tr, y_cur, yb)
                    y_cur = yt
                if y_cur < h - 0.001:
                    _add_quad(tl, tr, y_cur, h)

        return verts, faces

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
        ux = dx / length
        uy = dy / length
        nx = -uy * t / 2
        ny = ux * t / 2

        # Find openings on this wall
        wall_angle = math.atan2(dy, dx)
        wall_holes = []
        for op in openings:
            ox = op["x"] / 100
            oy = op["y"] / 100
            # Check angle alignment (opening should be
            # parallel to wall, within ~25 degrees)
            oa = op["angle"]
            angle_diff = abs(wall_angle - oa) % math.pi
            if angle_diff > 0.45 and angle_diff < (math.pi - 0.45):
                continue
            dist, proj_t = _point_to_segment_dist(
                ox, oy, xs, ys, xe, ye
            )
            # Use max of wall thickness and opening depth
            od = op["depth"] / 100
            max_dist = max(t, od) * 0.7
            if dist > max_dist:
                continue
            # Check projection is within wall segment
            # (with tolerance for opening half-width)
            ow = op["width"] / 100
            oh = op["height"] / 100
            oe = op["elevation"] / 100
            # Check elevation overlap with wall
            if oe >= h or oe + oh <= 0:
                continue
            pos_along = proj_t * length
            half_w = ow / 2
            wall_holes.append((
                pos_along - half_w,
                pos_along + half_w,
                oe,
                oe + oh,
            ))

        # Per-wall materials from Home.xml colors
        left_mtl = wall_mtl_name
        right_mtl = wall_mtl_name
        top_mtl = wall_mtl_name
        if w.get("leftColor"):
            lm = f"wall_{wi}_left"
            if _color_to_mtl(w["leftColor"], lm):
                left_mtl = lm
        if w.get("rightColor"):
            rm = f"wall_{wi}_right"
            if _color_to_mtl(w["rightColor"], rm):
                right_mtl = rm
        if w.get("topColor"):
            tm = f"wall_{wi}_top"
            if _color_to_mtl(w["topColor"], tm):
                top_mtl = tm

        out_lines.append(f"g Wall_{wi}\n")

        if not wall_holes:
            # Simple solid wall (no openings)
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
            for v in wv:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            b = vo + 1
            # Left side (front face)
            out_lines.append(
                f"usemtl {left_mtl}\n"
            )
            out_lines.append(
                f"f {b} {b+1} {b+5} {b+4}\n"
            )
            # Right side (back face)
            out_lines.append(
                f"usemtl {right_mtl}\n"
            )
            out_lines.append(
                f"f {b+2} {b+3} {b+7} {b+6}\n"
            )
            # Top
            out_lines.append(
                f"usemtl {top_mtl}\n"
            )
            out_lines.append(
                f"f {b+4} {b+5} {b+6} {b+7}\n"
            )
            # Bottom
            out_lines.append(
                f"usemtl {wall_mtl_name}\n"
            )
            out_lines.append(
                f"f {b} {b+3} {b+2} {b+1}\n"
            )
            # End caps
            out_lines.append(
                f"f {b} {b+4} {b+7} {b+3}\n"
            )
            out_lines.append(
                f"f {b+1} {b+2} {b+6} {b+5}\n"
            )
            vo += 8
        else:
            # Wall with openings - generate faces with holes
            vc = 0
            # Front face (left side)
            out_lines.append(
                f"usemtl {left_mtl}\n"
            )
            fv, ff = _wall_face_with_holes(
                xs - nx, ys - ny,
                xe - nx, ye - ny,
                h, wall_holes, vo
            )
            for v in fv:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            for face in ff:
                out_lines.append(
                    f"f {face[0]}"
                    f" {face[1]}"
                    f" {face[2]}"
                    f" {face[3]}\n"
                )
            vc += len(fv)

            # Back face (right side, reversed)
            out_lines.append(
                f"usemtl {right_mtl}\n"
            )
            bv, bf = _wall_face_with_holes(
                xs + nx, ys + ny,
                xe + nx, ye + ny,
                h, wall_holes, vo + vc
            )
            for v in bv:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            for face in bf:
                # Reverse winding for back face
                out_lines.append(
                    f"f {face[0]}"
                    f" {face[3]}"
                    f" {face[2]}"
                    f" {face[1]}\n"
                )
            vc += len(bv)

            # Top face
            out_lines.append(
                f"usemtl {top_mtl}\n"
            )
            tv = [
                (xs - nx, h, ys - ny),
                (xs + nx, h, ys + ny),
                (xe + nx, h, ye + ny),
                (xe - nx, h, ye - ny),
            ]
            for v in tv:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            b = vo + vc + 1
            out_lines.append(
                f"f {b} {b+1} {b+2} {b+3}\n"
            )
            vc += 4

            # Bottom face + end caps
            out_lines.append(
                f"usemtl {wall_mtl_name}\n"
            )
            bv2 = [
                (xs - nx, 0, ys - ny),
                (xe - nx, 0, ye - ny),
                (xe + nx, 0, ye + ny),
                (xs + nx, 0, ys + ny),
            ]
            for v in bv2:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            b = vo + vc + 1
            out_lines.append(
                f"f {b} {b+1} {b+2} {b+3}\n"
            )
            vc += 4

            # Left end cap
            lv = [
                (xs - nx, 0, ys - ny),
                (xs + nx, 0, ys + ny),
                (xs + nx, h, ys + ny),
                (xs - nx, h, ys - ny),
            ]
            for v in lv:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            b = vo + vc + 1
            out_lines.append(
                f"f {b} {b+1} {b+2} {b+3}\n"
            )
            vc += 4

            # Right end cap
            rv = [
                (xe - nx, 0, ye - ny),
                (xe - nx, h, ye - ny),
                (xe + nx, h, ye + ny),
                (xe + nx, 0, ye + ny),
            ]
            for v in rv:
                out_lines.append(
                    f"v {v[0]:.4f}"
                    f" {v[1]:.4f}"
                    f" {v[2]:.4f}\n"
                )
            b = vo + vc + 1
            out_lines.append(
                f"f {b} {b+1} {b+2} {b+3}\n"
            )
            vc += 4

            vo += vc
        wi += 1

    _LOGGER.info(
        "Assembly: %d objs, %d walls, %d mats, %d lines",
        oc, wi, len(all_materials), len(out_lines),
    )

    # --- Write assembled.obj ---
    obj_out = os.path.join(output_dir, "assembled.obj")
    with open(obj_out, 'w') as f:
        f.writelines(out_lines)

    # --- Write assembled.mtl ---
    mtl_out = os.path.join(output_dir, "assembled.mtl")
    with open(mtl_out, 'w') as f:
        f.write("# Combined materials from Sweet Home 3D\n\n")
        for mname, mlines in all_materials.items():
            f.write(f"newmtl {mname}\n")
            for ml in mlines:
                f.write(f"{ml}\n")
            f.write("\n")

    # --- Copy texture files ---
    for src, dest_name in texture_files:
        dp = os.path.join(output_dir, dest_name)
        try:
            shutil.copy2(src, dp)
        except Exception as e:
            _LOGGER.debug("Texture copy fail: %s", e)

    _LOGGER.info(
        "Wrote %s (%d textures)",
        obj_out, len(texture_files),
    )
    return obj_out


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.DEBUG)
    r = assemble_sh3d(sys.argv[1], sys.argv[2])
    print(f"Result: {r}")
