var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/* Generated from Java with JSweet 2.0.0-rc1 - http://www.jsweet.org */
var javax;
(function (javax) {
    var swing;
    (function (swing) {
        var event;
        (function (event) {
            /**
             * Constructs an UndoableEditEvent object.
             *
             * @param {*} source  the Object that originated the event
             * (typically <code>this</code>)
             * @param {*} edit    an UndoableEdit object
             * @class
             * @extends java.util.EventObject
             * @author Ray Ryan
             */
            var UndoableEditEvent = (function () {
                function UndoableEditEvent(source, edit) {
                    this.myEdit = null;
                    this.myEdit = edit;
                }
                /**
                 * Returns the edit value.
                 *
                 * @return {*} the UndoableEdit object encapsulating the edit
                 */
                UndoableEditEvent.prototype.getEdit = function () {
                    return this.myEdit;
                };
                return UndoableEditEvent;
            }());
            event.UndoableEditEvent = UndoableEditEvent;
            UndoableEditEvent["__class"] = "javax.swing.event.UndoableEditEvent";
            UndoableEditEvent["__interfaces"] = ["java.io.Serializable"];
        })(event = swing.event || (swing.event = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * Creates an <code>AbstractUndoableEdit</code> which defaults
             * <code>hasBeenDone</code> and <code>alive</code> to <code>true</code>.
             * @class
             * @author Ray Ryan
             */
            var AbstractUndoableEdit = (function () {
                function AbstractUndoableEdit() {
                    this.hasBeenDone = false;
                    this.alive = false;
                    this.hasBeenDone = true;
                    this.alive = true;
                }
                /**
                 * Sets <code>alive</code> to false. Note that this
                 * is a one way operation; dead edits cannot be resurrected.
                 * Sending <code>undo</code> or <code>redo</code> to
                 * a dead edit results in an exception being thrown.
                 *
                 * <p>Typically an edit is killed when it is consolidated by
                 * another edit's <code>addEdit</code> or <code>replaceEdit</code>
                 * method, or when it is dequeued from an <code>UndoManager</code>.
                 */
                AbstractUndoableEdit.prototype.die = function () {
                    this.alive = false;
                };
                /**
                 * Throws <code>CannotUndoException</code> if <code>canUndo</code>
                 * returns <code>false</code>. Sets <code>hasBeenDone</code>
                 * to <code>false</code>. Subclasses should override to undo the
                 * operation represented by this edit. Override should begin with
                 * a call to super.
                 *
                 * @exception CannotUndoException if <code>canUndo</code>
                 * returns <code>false</code>
                 * @see     #canUndo
                 */
                AbstractUndoableEdit.prototype.undo = function () {
                    if (!this.canUndo()) {
                        throw new javax.swing.undo.CannotUndoException();
                    }
                    this.hasBeenDone = false;
                };
                /**
                 * Returns true if this edit is <code>alive</code>
                 * and <code>hasBeenDone</code> is <code>true</code>.
                 *
                 * @return {boolean} true if this edit is <code>alive</code>
                 * and <code>hasBeenDone</code> is <code>true</code>
                 *
                 * @see     #die
                 * @see     #undo
                 * @see     #redo
                 */
                AbstractUndoableEdit.prototype.canUndo = function () {
                    return this.alive && this.hasBeenDone;
                };
                /**
                 * Throws <code>CannotRedoException</code> if <code>canRedo</code>
                 * returns false. Sets <code>hasBeenDone</code> to <code>true</code>.
                 * Subclasses should override to redo the operation represented by
                 * this edit. Override should begin with a call to super.
                 *
                 * @exception CannotRedoException if <code>canRedo</code>
                 * returns <code>false</code>
                 * @see     #canRedo
                 */
                AbstractUndoableEdit.prototype.redo = function () {
                    if (!this.canRedo()) {
                        throw new javax.swing.undo.CannotRedoException();
                    }
                    this.hasBeenDone = true;
                };
                /**
                 * Returns <code>true</code> if this edit is <code>alive</code>
                 * and <code>hasBeenDone</code> is <code>false</code>.
                 *
                 * @return {boolean} <code>true</code> if this edit is <code>alive</code>
                 * and <code>hasBeenDone</code> is <code>false</code>
                 * @see     #die
                 * @see     #undo
                 * @see     #redo
                 */
                AbstractUndoableEdit.prototype.canRedo = function () {
                    return this.alive && !this.hasBeenDone;
                };
                /**
                 * This default implementation returns false.
                 *
                 * @param {*} anEdit the edit to be added
                 * @return {boolean} false
                 *
                 * @see UndoableEdit#addEdit
                 */
                AbstractUndoableEdit.prototype.addEdit = function (anEdit) {
                    return false;
                };
                /**
                 * This default implementation returns false.
                 *
                 * @param {*} anEdit the edit to replace
                 * @return {boolean} false
                 *
                 * @see UndoableEdit#replaceEdit
                 */
                AbstractUndoableEdit.prototype.replaceEdit = function (anEdit) {
                    return false;
                };
                /**
                 * This default implementation returns true.
                 *
                 * @return {boolean} true
                 * @see UndoableEdit#isSignificant
                 */
                AbstractUndoableEdit.prototype.isSignificant = function () {
                    return true;
                };
                /**
                 * This default implementation returns "". Used by
                 * <code>getUndoPresentationName</code> and
                 * <code>getRedoPresentationName</code> to
                 * construct the strings they return. Subclasses should override to
                 * return an appropriate description of the operation this edit
                 * represents.
                 *
                 * @return {string} the empty string ""
                 *
                 * @see     #getUndoPresentationName
                 * @see     #getRedoPresentationName
                 */
                AbstractUndoableEdit.prototype.getPresentationName = function () {
                    return "";
                };
                /**
                 * Retreives the value from the defaults table with key
                 * <code>AbstractUndoableEdit.undoText</code> and returns
                 * that value followed by a space, followed by
                 * <code>getPresentationName</code>.
                 * If <code>getPresentationName</code> returns "",
                 * then the defaults value is returned alone.
                 *
                 * @return {string} the value from the defaults table with key
                 * <code>AbstractUndoableEdit.undoText</code>, followed
                 * by a space, followed by <code>getPresentationName</code>
                 * unless <code>getPresentationName</code> is "" in which
                 * case, the defaults value is returned alone.
                 * @see #getPresentationName
                 */
                AbstractUndoableEdit.prototype.getUndoPresentationName = function () {
                    return 'Undo ' + this.getPresentationName();
                };
                /**
                 * Retreives the value from the defaults table with key
                 * <code>AbstractUndoableEdit.redoText</code> and returns
                 * that value followed by a space, followed by
                 * <code>getPresentationName</code>.
                 * If <code>getPresentationName</code> returns "",
                 * then the defaults value is returned alone.
                 *
                 * @return {string} the value from the defaults table with key
                 * <code>AbstractUndoableEdit.redoText</code>, followed
                 * by a space, followed by <code>getPresentationName</code>
                 * unless <code>getPresentationName</code> is "" in which
                 * case, the defaults value is returned alone.
                 * @see #getPresentationName
                 */
                AbstractUndoableEdit.prototype.getRedoPresentationName = function () {
                    return 'Redo ' + this.getPresentationName();
                };
                /**
                 * Returns a string that displays and identifies this
                 * object's properties.
                 *
                 * @return {string} a String representation of this object
                 */
                AbstractUndoableEdit.prototype.toString = function () {
                    return (function (c) { return c["__class"] ? c["__class"] : c["name"]; })(this.constructor) + " hasBeenDone: " + this.hasBeenDone + " alive: " + this.alive;
                };
                return AbstractUndoableEdit;
            }());
            /**
             * String returned by <code>getUndoPresentationName</code>;
             * as of Java 2 platform v1.3.1 this field is no longer used. This value
             * is now localized and comes from the defaults table with key
             * <code>AbstractUndoableEdit.undoText</code>.
             *
             * @see javax.swing.UIDefaults
             */
            AbstractUndoableEdit.UndoName = "Undo";
            /**
             * String returned by <code>getRedoPresentationName</code>;
             * as of Java 2 platform v1.3.1 this field is no longer used. This value
             * is now localized and comes from the defaults table with key
             * <code>AbstractUndoableEdit.redoText</code>.
             *
             * @see javax.swing.UIDefaults
             */
            AbstractUndoableEdit.RedoName = "Redo";
            undo.AbstractUndoableEdit = AbstractUndoableEdit;
            AbstractUndoableEdit["__class"] = "javax.swing.undo.AbstractUndoableEdit";
            AbstractUndoableEdit["__interfaces"] = ["javax.swing.undo.UndoableEdit", "java.io.Serializable"];
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * Thrown when an UndoableEdit is told to <code>redo()</code> and can't.
             * <p>
             * <strong>Warning:</strong>
             * Serialized objects of this class will not be compatible with
             * future Swing releases. The current serialization support is
             * appropriate for short term storage or RMI between applications running
             * the same version of Swing.  As of 1.4, support for long term storage
             * of all JavaBeans&trade;
             * has been added to the <code>java.beans</code> package.
             * Please see {@link java.beans.XMLEncoder}.
             *
             * @author Ray Ryan
             * @class
             * @extends Error
             */
            var CannotRedoException = (function (_super) {
                __extends(CannotRedoException, _super);
                function CannotRedoException() {
                    return _super.call(this) || this;
                }
                return CannotRedoException;
            }(Error));
            undo.CannotRedoException = CannotRedoException;
            CannotRedoException["__class"] = "javax.swing.undo.CannotRedoException";
            CannotRedoException["__interfaces"] = ["java.io.Serializable"];
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * Thrown when an UndoableEdit is told to <code>undo()</code> and can't.
             * <p>
             * <strong>Warning:</strong>
             * Serialized objects of this class will not be compatible with
             * future Swing releases. The current serialization support is
             * appropriate for short term storage or RMI between applications running
             * the same version of Swing.  As of 1.4, support for long term storage
             * of all JavaBeans&trade;
             * has been added to the <code>java.beans</code> package.
             * Please see {@link java.beans.XMLEncoder}.
             *
             * @author Ray Ryan
             * @class
             * @extends Error
             */
            var CannotUndoException = (function (_super) {
                __extends(CannotUndoException, _super);
                function CannotUndoException() {
                    return _super.call(this) || this;
                }
                return CannotUndoException;
            }(Error));
            undo.CannotUndoException = CannotUndoException;
            CannotUndoException["__class"] = "javax.swing.undo.CannotUndoException";
            CannotUndoException["__interfaces"] = ["java.io.Serializable"];
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            var StateEditable;
            (function (StateEditable) {
                /**
                 * Resource ID for this class.
                 */
                StateEditable.RCSID = "$Id: StateEditable.java,v 1.2 1997/09/08 19:39:08 marklin Exp $";
            })(StateEditable = undo.StateEditable || (undo.StateEditable = {}));
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * Constructs an <code>UndoableEditSupport</code> object.
             *
             * @param {*} r
             * an <code>Object</code>
             * @class
             * @author Ray Ryan
             */
            var UndoableEditSupport = (function () {
                function UndoableEditSupport(r) {
                    var _this = this;
                    if (((r != null) || r === null)) {
                        var __args = Array.prototype.slice.call(arguments);
                        this.updateLevel = 0;
                        this.compoundEdit = null;
                        this.listeners = null;
                        this.realSource = null;
                        this.updateLevel = 0;
                        this.compoundEdit = null;
                        this.listeners = null;
                        this.realSource = null;
                        (function () {
                            _this.realSource = r == null ? _this : r;
                            _this.updateLevel = 0;
                            _this.compoundEdit = null;
                            _this.listeners = ([]);
                        })();
                    }
                    else if (r === undefined) {
                        var __args = Array.prototype.slice.call(arguments);
                        {
                            var __args_1 = Array.prototype.slice.call(arguments);
                            var r_1 = null;
                            this.updateLevel = 0;
                            this.compoundEdit = null;
                            this.listeners = null;
                            this.realSource = null;
                            this.updateLevel = 0;
                            this.compoundEdit = null;
                            this.listeners = null;
                            this.realSource = null;
                            (function () {
                                _this.realSource = r_1 == null ? _this : r_1;
                                _this.updateLevel = 0;
                                _this.compoundEdit = null;
                                _this.listeners = ([]);
                            })();
                        }
                    }
                    else
                        throw new Error('invalid overload');
                }
                /**
                 * Registers an <code>UndoableEditListener</code>. The listener is notified
                 * whenever an edit occurs which can be undone.
                 *
                 * @param {*} l
                 * an <code>UndoableEditListener</code> object
                 * @see #removeUndoableEditListener
                 */
                UndoableEditSupport.prototype.addUndoableEditListener = function (l) {
                    /* addElement */ (this.listeners.push(l) > 0);
                };
                /**
                 * Removes an <code>UndoableEditListener</code>.
                 *
                 * @param {*} l
                 * the <code>UndoableEditListener</code> object to be removed
                 * @see #addUndoableEditListener
                 */
                UndoableEditSupport.prototype.removeUndoableEditListener = function (l) {
                    /* removeElement */ (function (a) { return a.splice(a.indexOf(l), 1); })(this.listeners);
                };
                /**
                 * Returns an array of all the <code>UndoableEditListener</code>s added to
                 * this UndoableEditSupport with addUndoableEditListener().
                 *
                 * @return {Array} all of the <code>UndoableEditListener</code>s added or an empty
                 * array if no listeners have been added
                 * @since 1.4
                 */
                UndoableEditSupport.prototype.getUndoableEditListeners = function () {
                    return this.listeners.slice(0);
                };
                /**
                 * Called only from <code>postEdit</code> and <code>endUpdate</code>. Calls
                 * <code>undoableEditHappened</code> in all listeners. No synchronization is
                 * performed here, since the two calling methods are synchronized.
                 * @param {*} e
                 */
                UndoableEditSupport.prototype._postEdit = function (e) {
                    var ev = new javax.swing.event.UndoableEditEvent(this.realSource, e);
                    var cursor = (function (a) { var i = 0; return { nextElement: function () { return i < a.length ? a[i++] : null; }, hasMoreElements: function () { return i < a.length; } }; })((function (o) { if (o.clone != undefined) {
                        return o.clone();
                    }
                    else {
                        var clone = Object.create(o);
                        for (var p in o) {
                            if (o.hasOwnProperty(p))
                                clone[p] = o[p];
                        }
                        return clone;
                    } })(this.listeners));
                    while ((cursor.hasMoreElements())) {
                        cursor.nextElement().undoableEditHappened(ev);
                    }
                    ;
                };
                /**
                 * DEADLOCK WARNING: Calling this method may call
                 * <code>undoableEditHappened</code> in all listeners. It is unwise to call
                 * this method from one of its listeners.
                 * @param {*} e
                 */
                UndoableEditSupport.prototype.postEdit = function (e) {
                    if (this.updateLevel === 0) {
                        this._postEdit(e);
                    }
                    else {
                        this.compoundEdit.addEdit(e);
                    }
                };
                /**
                 * Returns the update level value.
                 *
                 * @return {number} an integer representing the update level
                 */
                UndoableEditSupport.prototype.getUpdateLevel = function () {
                    return this.updateLevel;
                };
                /**
                 *
                 */
                UndoableEditSupport.prototype.beginUpdate = function () {
                    if (this.updateLevel === 0) {
                        this.compoundEdit = this.createCompoundEdit();
                    }
                    this.updateLevel++;
                };
                /**
                 * Called only from <code>beginUpdate</code>. Exposed here for subclasses'
                 * use.
                 * @return {javax.swing.undo.CompoundEdit}
                 */
                UndoableEditSupport.prototype.createCompoundEdit = function () {
                    return new javax.swing.undo.CompoundEdit();
                };
                /**
                 * DEADLOCK WARNING: Calling this method may call
                 * <code>undoableEditHappened</code> in all listeners. It is unwise to call
                 * this method from one of its listeners.
                 */
                UndoableEditSupport.prototype.endUpdate = function () {
                    this.updateLevel--;
                    if (this.updateLevel === 0) {
                        this.compoundEdit.end();
                        this._postEdit(this.compoundEdit);
                        this.compoundEdit = null;
                    }
                };
                /**
                 * Returns a string that displays and identifies this object's properties.
                 *
                 * @return {string} a <code>String</code> representation of this object
                 */
                UndoableEditSupport.prototype.toString = function () {
                    return (function (c) { return c["__class"] ? c["__class"] : c["name"]; })(this.constructor) + " updateLevel: " + this.updateLevel + " listeners: " + (function (a) { return a ? '[' + a.join(', ') + ']' : 'null'; })(this.listeners) + " compoundEdit: " + this.compoundEdit;
                };
                return UndoableEditSupport;
            }());
            undo.UndoableEditSupport = UndoableEditSupport;
            UndoableEditSupport["__class"] = "javax.swing.undo.UndoableEditSupport";
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * A concrete subclass of AbstractUndoableEdit, used to assemble little
             * UndoableEdits into great big ones.
             *
             * @author Ray Ryan
             * @class
             * @extends javax.swing.undo.AbstractUndoableEdit
             */
            var CompoundEdit = (function (_super) {
                __extends(CompoundEdit, _super);
                function CompoundEdit() {
                    var _this = _super.call(this) || this;
                    _this.inProgress = false;
                    _this.edits = null;
                    _this.inProgress = true;
                    _this.edits = ([]);
                    return _this;
                }
                /**
                 * Sends <code>undo</code> to all contained
                 * <code>UndoableEdits</code> in the reverse of
                 * the order in which they were added.
                 */
                CompoundEdit.prototype.undo = function () {
                    _super.prototype.undo.call(this);
                    var i = this.edits.length;
                    while ((i-- > 0)) {
                        var e = this.edits[i];
                        e.undo();
                    }
                    ;
                };
                /**
                 * Sends <code>redo</code> to all contained
                 * <code>UndoableEdit</code>s in the order in
                 * which they were added.
                 */
                CompoundEdit.prototype.redo = function () {
                    _super.prototype.redo.call(this);
                    var cursor = (function (a) { var i = 0; return { nextElement: function () { return i < a.length ? a[i++] : null; }, hasMoreElements: function () { return i < a.length; } }; })(this.edits);
                    while ((cursor.hasMoreElements())) {
                        cursor.nextElement().redo();
                    }
                    ;
                };
                /**
                 * Returns the last <code>UndoableEdit</code> in
                 * <code>edits</code>, or <code>null</code>
                 * if <code>edits</code> is empty.
                 * @return {*}
                 */
                CompoundEdit.prototype.lastEdit = function () {
                    var count = this.edits.length;
                    if (count > 0)
                        return this.edits[count - 1];
                    else
                        return null;
                };
                /**
                 * Sends <code>die</code> to each subedit,
                 * in the reverse of the order that they were added.
                 */
                CompoundEdit.prototype.die = function () {
                    var size = this.edits.length;
                    for (var i = size - 1; i >= 0; i--) {
                        var e = this.edits[i];
                        e.die();
                    }
                    ;
                    _super.prototype.die.call(this);
                };
                /**
                 * If this edit is <code>inProgress</code>,
                 * accepts <code>anEdit</code> and returns true.
                 *
                 * <p>The last edit added to this <code>CompoundEdit</code>
                 * is given a chance to <code>addEdit(anEdit)</code>.
                 * If it refuses (returns false), <code>anEdit</code> is
                 * given a chance to <code>replaceEdit</code> the last edit.
                 * If <code>anEdit</code> returns false here,
                 * it is added to <code>edits</code>.
                 *
                 * @param {*} anEdit the edit to be added
                 * @return {boolean} true if the edit is <code>inProgress</code>;
                 * otherwise returns false
                 */
                CompoundEdit.prototype.addEdit = function (anEdit) {
                    if (!this.inProgress) {
                        return false;
                    }
                    else {
                        var last = this.lastEdit();
                        if (last == null) {
                            /* addElement */ (this.edits.push(anEdit) > 0);
                        }
                        else if (!last.addEdit(anEdit)) {
                            if (anEdit.replaceEdit(last)) {
                                /* removeElementAt */ this.edits.splice(/* size */ this.edits.length - 1, 1);
                            }
                            /* addElement */ (this.edits.push(anEdit) > 0);
                        }
                        return true;
                    }
                };
                /**
                 * Sets <code>inProgress</code> to false.
                 *
                 * @see #canUndo
                 * @see #canRedo
                 */
                CompoundEdit.prototype.end = function () {
                    this.inProgress = false;
                };
                /**
                 * Returns false if <code>isInProgress</code> or if super
                 * returns false.
                 *
                 * @see     #isInProgress
                 * @return {boolean}
                 */
                CompoundEdit.prototype.canUndo = function () {
                    return !this.isInProgress() && _super.prototype.canUndo.call(this);
                };
                /**
                 * Returns false if <code>isInProgress</code> or if super
                 * returns false.
                 *
                 * @see     #isInProgress
                 * @return {boolean}
                 */
                CompoundEdit.prototype.canRedo = function () {
                    return !this.isInProgress() && _super.prototype.canRedo.call(this);
                };
                /**
                 * Returns true if this edit is in progress--that is, it has not
                 * received end. This generally means that edits are still being
                 * added to it.
                 *
                 * @see     #end
                 * @return {boolean}
                 */
                CompoundEdit.prototype.isInProgress = function () {
                    return this.inProgress;
                };
                /**
                 * Returns true if any of the <code>UndoableEdit</code>s
                 * in <code>edits</code> do.
                 * Returns false if they all return false.
                 * @return {boolean}
                 */
                CompoundEdit.prototype.isSignificant = function () {
                    var cursor = (function (a) { var i = 0; return { nextElement: function () { return i < a.length ? a[i++] : null; }, hasMoreElements: function () { return i < a.length; } }; })(this.edits);
                    while ((cursor.hasMoreElements())) {
                        if (cursor.nextElement().isSignificant()) {
                            return true;
                        }
                    }
                    ;
                    return false;
                };
                /**
                 * Returns <code>getPresentationName</code> from the
                 * last <code>UndoableEdit</code> added to
                 * <code>edits</code>. If <code>edits</code> is empty,
                 * calls super.
                 * @return {string}
                 */
                CompoundEdit.prototype.getPresentationName = function () {
                    var last = this.lastEdit();
                    if (last != null) {
                        return last.getPresentationName();
                    }
                    else {
                        return _super.prototype.getPresentationName.call(this);
                    }
                };
                /**
                 * Returns <code>getUndoPresentationName</code>
                 * from the last <code>UndoableEdit</code>
                 * added to <code>edits</code>.
                 * If <code>edits</code> is empty, calls super.
                 * @return {string}
                 */
                CompoundEdit.prototype.getUndoPresentationName = function () {
                    var last = this.lastEdit();
                    if (last != null) {
                        return last.getUndoPresentationName();
                    }
                    else {
                        return _super.prototype.getUndoPresentationName.call(this);
                    }
                };
                /**
                 * Returns <code>getRedoPresentationName</code>
                 * from the last <code>UndoableEdit</code>
                 * added to <code>edits</code>.
                 * If <code>edits</code> is empty, calls super.
                 * @return {string}
                 */
                CompoundEdit.prototype.getRedoPresentationName = function () {
                    var last = this.lastEdit();
                    if (last != null) {
                        return last.getRedoPresentationName();
                    }
                    else {
                        return _super.prototype.getRedoPresentationName.call(this);
                    }
                };
                /**
                 * Returns a string that displays and identifies this
                 * object's properties.
                 *
                 * @return {string} a String representation of this object
                 */
                CompoundEdit.prototype.toString = function () {
                    return _super.prototype.toString.call(this) + " inProgress: " + this.inProgress + " edits: " + (function (a) { return a ? '[' + a.join(', ') + ']' : 'null'; })(this.edits);
                };
                return CompoundEdit;
            }(javax.swing.undo.AbstractUndoableEdit));
            undo.CompoundEdit = CompoundEdit;
            CompoundEdit["__class"] = "javax.swing.undo.CompoundEdit";
            CompoundEdit["__interfaces"] = ["javax.swing.undo.UndoableEdit", "java.io.Serializable"];
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * Create and return a new StateEdit with a presentation name.
             *
             * @param {*} anObject The object to watch for changing state
             * @param {string} name The presentation name to be used for this edit
             *
             * @see StateEdit
             * @class
             * @extends javax.swing.undo.AbstractUndoableEdit
             * @author Ray Ryan
             */
            var StateEdit = (function (_super) {
                __extends(StateEdit, _super);
                function StateEdit(anObject, name) {
                    var _this = this;
                    if (((anObject != null && (anObject["__interfaces"] != null && anObject["__interfaces"].indexOf("javax.swing.undo.StateEditable") >= 0 || anObject.constructor != null && anObject.constructor["__interfaces"] != null && anObject.constructor["__interfaces"].indexOf("javax.swing.undo.StateEditable") >= 0)) || anObject === null) && ((typeof name === 'string') || name === null)) {
                        var __args = Array.prototype.slice.call(arguments);
                        _this = _super.call(this) || this;
                        _this.object = null;
                        _this.preState = null;
                        _this.postState = null;
                        _this.undoRedoName = null;
                        _this.object = null;
                        _this.preState = null;
                        _this.postState = null;
                        _this.undoRedoName = null;
                        (function () {
                            _this.init(anObject, name);
                        })();
                    }
                    else if (((anObject != null && (anObject["__interfaces"] != null && anObject["__interfaces"].indexOf("javax.swing.undo.StateEditable") >= 0 || anObject.constructor != null && anObject.constructor["__interfaces"] != null && anObject.constructor["__interfaces"].indexOf("javax.swing.undo.StateEditable") >= 0)) || anObject === null) && name === undefined) {
                        var __args = Array.prototype.slice.call(arguments);
                        _this = _super.call(this) || this;
                        _this.object = null;
                        _this.preState = null;
                        _this.postState = null;
                        _this.undoRedoName = null;
                        _this.object = null;
                        _this.preState = null;
                        _this.postState = null;
                        _this.undoRedoName = null;
                        (function () {
                            _this.init(anObject, null);
                        })();
                    }
                    else
                        throw new Error('invalid overload');
                    return _this;
                }
                StateEdit.prototype.init = function (anObject, name) {
                    this.object = anObject;
                    this.preState = ({});
                    this.object.storeState(this.preState);
                    this.postState = null;
                    this.undoRedoName = name;
                };
                /**
                 * Gets the post-edit state of the StateEditable object and
                 * ends the edit.
                 */
                StateEdit.prototype.end = function () {
                    this.postState = ({});
                    this.object.storeState(this.postState);
                    this.removeRedundantState();
                };
                /**
                 * Tells the edited object to apply the state prior to the edit
                 */
                StateEdit.prototype.undo = function () {
                    _super.prototype.undo.call(this);
                    this.object.restoreState(this.preState);
                };
                /**
                 * Tells the edited object to apply the state after the edit
                 */
                StateEdit.prototype.redo = function () {
                    _super.prototype.redo.call(this);
                    this.object.restoreState(this.postState);
                };
                /**
                 * Gets the presentation name for this edit
                 * @return {string}
                 */
                StateEdit.prototype.getPresentationName = function () {
                    return this.undoRedoName;
                };
                /**
                 * Remove redundant key/values in state hashtables.
                 */
                StateEdit.prototype.removeRedundantState = function () {
                    var uselessKeys = ([]);
                    var myKeys = this.preState.keys();
                    while ((myKeys.hasMoreElements())) {
                        var myKey = myKeys.nextElement();
                        if ((function (m, k) { if (m.entries == null)
                            m.entries = []; for (var i = 0; i < m.entries.length; i++)
                            if (m.entries[i].key.equals != null && m.entries[i].key.equals(k) || m.entries[i].key === k) {
                                return true;
                            } return false; })(this.postState, myKey) && (function (o1, o2) { if (o1 && o1.equals) {
                            return o1.equals(o2);
                        }
                        else {
                            return o1 === o2;
                        } })(/* get */ (function (m, k) { if (m.entries == null)
                            m.entries = []; for (var i = 0; i < m.entries.length; i++)
                            if (m.entries[i].key.equals != null && m.entries[i].key.equals(k) || m.entries[i].key === k) {
                                return m.entries[i].value;
                            } return null; })(this.postState, myKey), /* get */ (function (m, k) { if (m.entries == null)
                            m.entries = []; for (var i = 0; i < m.entries.length; i++)
                            if (m.entries[i].key.equals != null && m.entries[i].key.equals(k) || m.entries[i].key === k) {
                                return m.entries[i].value;
                            } return null; })(this.preState, myKey))) {
                            /* addElement */ (uselessKeys.push(myKey) > 0);
                        }
                    }
                    ;
                    for (var i = uselessKeys.length - 1; i >= 0; i--) {
                        var myKey = uselessKeys[i];
                        /* remove */ (function (m, k) { if (m.entries == null)
                            m.entries = []; for (var i_1 = 0; i_1 < m.entries.length; i_1++)
                            if (m.entries[i_1].key.equals != null && m.entries[i_1].key.equals(k) || m.entries[i_1].key === k) {
                                return m.entries.splice(i_1, 1)[0];
                            } })(this.preState, myKey);
                        /* remove */ (function (m, k) { if (m.entries == null)
                            m.entries = []; for (var i_2 = 0; i_2 < m.entries.length; i_2++)
                            if (m.entries[i_2].key.equals != null && m.entries[i_2].key.equals(k) || m.entries[i_2].key === k) {
                                return m.entries.splice(i_2, 1)[0];
                            } })(this.postState, myKey);
                    }
                    ;
                };
                return StateEdit;
            }(javax.swing.undo.AbstractUndoableEdit));
            StateEdit.RCSID = "$Id: StateEdit.java,v 1.6 1997/10/01 20:05:51 sandipc Exp $";
            undo.StateEdit = StateEdit;
            StateEdit["__class"] = "javax.swing.undo.StateEdit";
            StateEdit["__interfaces"] = ["javax.swing.undo.UndoableEdit", "java.io.Serializable"];
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
(function (javax) {
    var swing;
    (function (swing) {
        var undo;
        (function (undo) {
            /**
             * Creates a new <code>UndoManager</code>.
             * @class
             * @extends javax.swing.undo.CompoundEdit
             * @author Ray Ryan
             */
            var UndoManager = (function (_super) {
                __extends(UndoManager, _super);
                function UndoManager() {
                    var _this = _super.call(this) || this;
                    _this.indexOfNextAdd = 0;
                    _this.limit = 0;
                    _this.indexOfNextAdd = 0;
                    _this.limit = 100;
                    /* ensureCapacity */ ;
                    return _this;
                }
                /**
                 * Returns the maximum number of edits this {@code UndoManager}
                 * holds. A value less than 0 indicates the number of edits is not
                 * limited.
                 *
                 * @return {number} the maximum number of edits this {@code UndoManager} holds
                 * @see #addEdit
                 * @see #setLimit
                 */
                UndoManager.prototype.getLimit = function () {
                    return this.limit;
                };
                /**
                 * Empties the undo manager sending each edit a <code>die</code> message
                 * in the process.
                 *
                 * @see AbstractUndoableEdit#die
                 */
                UndoManager.prototype.discardAllEdits = function () {
                    for (var index121 = 0; index121 < this.edits.length; index121++) {
                        var e = this.edits[index121];
                        {
                            e.die();
                        }
                    }
                    this.edits = ([]);
                    this.indexOfNextAdd = 0;
                };
                /**
                 * Reduces the number of queued edits to a range of size limit,
                 * centered on the index of the next edit.
                 */
                UndoManager.prototype.trimForLimit = function () {
                    if (this.limit >= 0) {
                        var size = this.edits.length;
                        if (size > this.limit) {
                            var halfLimit = (this.limit / 2 | 0);
                            var keepFrom = this.indexOfNextAdd - 1 - halfLimit;
                            var keepTo = this.indexOfNextAdd - 1 + halfLimit;
                            if (keepTo - keepFrom + 1 > this.limit) {
                                keepFrom++;
                            }
                            if (keepFrom < 0) {
                                keepTo -= keepFrom;
                                keepFrom = 0;
                            }
                            if (keepTo >= size) {
                                var delta = size - keepTo - 1;
                                keepTo += delta;
                                keepFrom += delta;
                            }
                            this.trimEdits(keepTo + 1, size - 1);
                            this.trimEdits(0, keepFrom - 1);
                        }
                    }
                };
                /**
                 * Removes edits in the specified range.
                 * All edits in the given range (inclusive, and in reverse order)
                 * will have <code>die</code> invoked on them and are removed from
                 * the list of edits. This has no effect if
                 * <code>from</code> &gt; <code>to</code>.
                 *
                 * @param {number} from the minimum index to remove
                 * @param {number} to the maximum index to remove
                 */
                UndoManager.prototype.trimEdits = function (from, to) {
                    if (from <= to) {
                        for (var i = to; from <= i; i--) {
                            var e = this.edits[i];
                            e.die();
                            /* removeElementAt */ this.edits.splice(i, 1);
                        }
                        ;
                        if (this.indexOfNextAdd > to) {
                            this.indexOfNextAdd -= to - from + 1;
                        }
                        else if (this.indexOfNextAdd >= from) {
                            this.indexOfNextAdd = from;
                        }
                    }
                };
                /**
                 * Sets the maximum number of edits this <code>UndoManager</code>
                 * holds. A value less than 0 indicates the number of edits is not
                 * limited. If edits need to be discarded to shrink the limit,
                 * <code>die</code> will be invoked on them in the reverse
                 * order they were added.  The default is 100.
                 *
                 * @param {number} l the new limit
                 * @throws RuntimeException if this {@code UndoManager} is not in progress
                 * ({@code end} has been invoked)
                 * @see #isInProgress
                 * @see #end
                 * @see #addEdit
                 * @see #getLimit
                 */
                UndoManager.prototype.setLimit = function (l) {
                    if (!this.inProgress)
                        throw Object.defineProperty(new Error("Attempt to call UndoManager.setLimit() after UndoManager.end() has been called"), '__classes', { configurable: true, value: ['java.lang.Throwable', 'java.lang.Object', 'java.lang.RuntimeException', 'java.lang.Exception'] });
                    this.limit = l;
                    this.trimForLimit();
                };
                /**
                 * Returns the the next significant edit to be undone if <code>undo</code>
                 * is invoked. This returns <code>null</code> if there are no edits
                 * to be undone.
                 *
                 * @return {*} the next significant edit to be undone
                 */
                UndoManager.prototype.editToBeUndone = function () {
                    var i = this.indexOfNextAdd;
                    while ((i > 0)) {
                        var edit = this.edits[--i];
                        if (edit.isSignificant()) {
                            return edit;
                        }
                    }
                    ;
                    return null;
                };
                /**
                 * Returns the the next significant edit to be redone if <code>redo</code>
                 * is invoked. This returns <code>null</code> if there are no edits
                 * to be redone.
                 *
                 * @return {*} the next significant edit to be redone
                 */
                UndoManager.prototype.editToBeRedone = function () {
                    var count = this.edits.length;
                    var i = this.indexOfNextAdd;
                    while ((i < count)) {
                        var edit = this.edits[i++];
                        if (edit.isSignificant()) {
                            return edit;
                        }
                    }
                    ;
                    return null;
                };
                /**
                 * Undoes all changes from the index of the next edit to
                 * <code>edit</code>, updating the index of the next edit appropriately.
                 *
                 * @throws CannotUndoException if one of the edits throws
                 * <code>CannotUndoException</code>
                 * @param {*} edit
                 */
                UndoManager.prototype.undoTo = function (edit) {
                    var done = false;
                    while ((!done)) {
                        var next = this.edits[--this.indexOfNextAdd];
                        next.undo();
                        done = next === edit;
                    }
                    ;
                };
                /**
                 * Redoes all changes from the index of the next edit to
                 * <code>edit</code>, updating the index of the next edit appropriately.
                 *
                 * @throws CannotRedoException if one of the edits throws
                 * <code>CannotRedoException</code>
                 * @param {*} edit
                 */
                UndoManager.prototype.redoTo = function (edit) {
                    var done = false;
                    while ((!done)) {
                        var next = this.edits[this.indexOfNextAdd++];
                        next.redo();
                        done = next === edit;
                    }
                    ;
                };
                /**
                 * Convenience method that invokes one of <code>undo</code> or
                 * <code>redo</code>. If any edits have been undone (the index of
                 * the next edit is less than the length of the edits list) this
                 * invokes <code>redo</code>, otherwise it invokes <code>undo</code>.
                 *
                 * @see #canUndoOrRedo
                 * @see #getUndoOrRedoPresentationName
                 * @throws CannotUndoException if one of the edits throws
                 * <code>CannotUndoException</code>
                 * @throws CannotRedoException if one of the edits throws
                 * <code>CannotRedoException</code>
                 */
                UndoManager.prototype.undoOrRedo = function () {
                    if (this.indexOfNextAdd === this.edits.length) {
                        this.undo();
                    }
                    else {
                        this.redo();
                    }
                };
                /**
                 * Returns true if it is possible to invoke <code>undo</code> or
                 * <code>redo</code>.
                 *
                 * @return {boolean} true if invoking <code>canUndoOrRedo</code> is valid
                 * @see #undoOrRedo
                 */
                UndoManager.prototype.canUndoOrRedo = function () {
                    if (this.indexOfNextAdd === this.edits.length) {
                        return this.canUndo();
                    }
                    else {
                        return this.canRedo();
                    }
                };
                /**
                 * Undoes the appropriate edits.  If <code>end</code> has been
                 * invoked this calls through to the superclass, otherwise
                 * this invokes <code>undo</code> on all edits between the
                 * index of the next edit and the last significant edit, updating
                 * the index of the next edit appropriately.
                 *
                 * @throws CannotUndoException if one of the edits throws
                 * <code>CannotUndoException</code> or there are no edits
                 * to be undone
                 * @see CompoundEdit#end
                 * @see #canUndo
                 * @see #editToBeUndone
                 */
                UndoManager.prototype.undo = function () {
                    if (this.inProgress) {
                        var edit = this.editToBeUndone();
                        if (edit == null) {
                            throw new javax.swing.undo.CannotUndoException();
                        }
                        this.undoTo(edit);
                    }
                    else {
                        _super.prototype.undo.call(this);
                    }
                };
                /**
                 * Returns true if edits may be undone.  If <code>end</code> has
                 * been invoked, this returns the value from super.  Otherwise
                 * this returns true if there are any edits to be undone
                 * (<code>editToBeUndone</code> returns non-<code>null</code>).
                 *
                 * @return {boolean} true if there are edits to be undone
                 * @see CompoundEdit#canUndo
                 * @see #editToBeUndone
                 */
                UndoManager.prototype.canUndo = function () {
                    if (this.inProgress) {
                        var edit = this.editToBeUndone();
                        return edit != null && edit.canUndo();
                    }
                    else {
                        return _super.prototype.canUndo.call(this);
                    }
                };
                /**
                 * Redoes the appropriate edits.  If <code>end</code> has been
                 * invoked this calls through to the superclass.  Otherwise
                 * this invokes <code>redo</code> on all edits between the
                 * index of the next edit and the next significant edit, updating
                 * the index of the next edit appropriately.
                 *
                 * @throws CannotRedoException if one of the edits throws
                 * <code>CannotRedoException</code> or there are no edits
                 * to be redone
                 * @see CompoundEdit#end
                 * @see #canRedo
                 * @see #editToBeRedone
                 */
                UndoManager.prototype.redo = function () {
                    if (this.inProgress) {
                        var edit = this.editToBeRedone();
                        if (edit == null) {
                            throw new javax.swing.undo.CannotRedoException();
                        }
                        this.redoTo(edit);
                    }
                    else {
                        _super.prototype.redo.call(this);
                    }
                };
                /**
                 * Returns true if edits may be redone.  If <code>end</code> has
                 * been invoked, this returns the value from super.  Otherwise,
                 * this returns true if there are any edits to be redone
                 * (<code>editToBeRedone</code> returns non-<code>null</code>).
                 *
                 * @return {boolean} true if there are edits to be redone
                 * @see CompoundEdit#canRedo
                 * @see #editToBeRedone
                 */
                UndoManager.prototype.canRedo = function () {
                    if (this.inProgress) {
                        var edit = this.editToBeRedone();
                        return edit != null && edit.canRedo();
                    }
                    else {
                        return _super.prototype.canRedo.call(this);
                    }
                };
                /**
                 * Adds an <code>UndoableEdit</code> to this
                 * <code>UndoManager</code>, if it's possible.  This removes all
                 * edits from the index of the next edit to the end of the edits
                 * list.  If <code>end</code> has been invoked the edit is not added
                 * and <code>false</code> is returned.  If <code>end</code> hasn't
                 * been invoked this returns <code>true</code>.
                 *
                 * @param {*} anEdit the edit to be added
                 * @return {boolean} true if <code>anEdit</code> can be incorporated into this
                 * edit
                 * @see CompoundEdit#end
                 * @see CompoundEdit#addEdit
                 */
                UndoManager.prototype.addEdit = function (anEdit) {
                    var retVal;
                    this.trimEdits(this.indexOfNextAdd, /* size */ this.edits.length - 1);
                    retVal = _super.prototype.addEdit.call(this, anEdit);
                    if (this.inProgress) {
                        retVal = true;
                    }
                    this.indexOfNextAdd = this.edits.length;
                    this.trimForLimit();
                    return retVal;
                };
                /**
                 * Turns this <code>UndoManager</code> into a normal
                 * <code>CompoundEdit</code>.  This removes all edits that have
                 * been undone.
                 *
                 * @see CompoundEdit#end
                 */
                UndoManager.prototype.end = function () {
                    _super.prototype.end.call(this);
                    this.trimEdits(this.indexOfNextAdd, /* size */ this.edits.length - 1);
                };
                /**
                 * Convenience method that returns either
                 * <code>getUndoPresentationName</code> or
                 * <code>getRedoPresentationName</code>.  If the index of the next
                 * edit equals the size of the edits list,
                 * <code>getUndoPresentationName</code> is returned, otherwise
                 * <code>getRedoPresentationName</code> is returned.
                 *
                 * @return {string} undo or redo name
                 */
                UndoManager.prototype.getUndoOrRedoPresentationName = function () {
                    if (this.indexOfNextAdd === this.edits.length) {
                        return this.getUndoPresentationName();
                    }
                    else {
                        return this.getRedoPresentationName();
                    }
                };
                /**
                 * Returns a description of the undoable form of this edit.
                 * If <code>end</code> has been invoked this calls into super.
                 * Otherwise if there are edits to be undone, this returns
                 * the value from the next significant edit that will be undone.
                 * If there are no edits to be undone and <code>end</code> has not
                 * been invoked this returns the value from the <code>UIManager</code>
                 * property "AbstractUndoableEdit.undoText".
                 *
                 * @return {string} a description of the undoable form of this edit
                 * @see     #undo
                 * @see     CompoundEdit#getUndoPresentationName
                 */
                UndoManager.prototype.getUndoPresentationName = function () {
                    if (this.inProgress) {
                        if (this.canUndo()) {
                            return this.editToBeUndone().getUndoPresentationName();
                        }
                        else {
                            return 'Undo';
                        }
                    }
                    else {
                        return _super.prototype.getUndoPresentationName.call(this);
                    }
                };
                /**
                 * Returns a description of the redoable form of this edit.
                 * If <code>end</code> has been invoked this calls into super.
                 * Otherwise if there are edits to be redone, this returns
                 * the value from the next significant edit that will be redone.
                 * If there are no edits to be redone and <code>end</code> has not
                 * been invoked this returns the value from the <code>UIManager</code>
                 * property "AbstractUndoableEdit.redoText".
                 *
                 * @return {string} a description of the redoable form of this edit
                 * @see     #redo
                 * @see     CompoundEdit#getRedoPresentationName
                 */
                UndoManager.prototype.getRedoPresentationName = function () {
                    if (this.inProgress) {
                        if (this.canRedo()) {
                            return this.editToBeRedone().getRedoPresentationName();
                        }
                        else {
                            return 'Redo';
                        }
                    }
                    else {
                        return _super.prototype.getRedoPresentationName.call(this);
                    }
                };
                /**
                 * An <code>UndoableEditListener</code> method. This invokes
                 * <code>addEdit</code> with <code>e.getEdit()</code>.
                 *
                 * @param {javax.swing.event.UndoableEditEvent} e the <code>UndoableEditEvent</code> the
                 * <code>UndoableEditEvent</code> will be added from
                 * @see #addEdit
                 */
                UndoManager.prototype.undoableEditHappened = function (e) {
                    this.addEdit(e.getEdit());
                };
                /**
                 * Returns a string that displays and identifies this
                 * object's properties.
                 *
                 * @return {string} a String representation of this object
                 */
                UndoManager.prototype.toString = function () {
                    return _super.prototype.toString.call(this) + " limit: " + this.limit + " indexOfNextAdd: " + this.indexOfNextAdd;
                };
                return UndoManager;
            }(javax.swing.undo.CompoundEdit));
            undo.UndoManager = UndoManager;
            UndoManager["__class"] = "javax.swing.undo.UndoManager";
            UndoManager["__interfaces"] = ["java.util.EventListener", "javax.swing.event.UndoableEditListener", "javax.swing.undo.UndoableEdit", "java.io.Serializable"];
        })(undo = swing.undo || (swing.undo = {}));
    })(swing = javax.swing || (javax.swing = {}));
})(javax || (javax = {}));
