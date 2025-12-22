// This is based on OBS's alignments.
var Alignment;
(function (Alignment) {
    Alignment[Alignment["Center"] = 0] = "Center";
    Alignment[Alignment["CenterLeft"] = 1] = "CenterLeft";
    Alignment[Alignment["CenterRight"] = 2] = "CenterRight";
    Alignment[Alignment["Unused1"] = 3] = "Unused1";
    Alignment[Alignment["TopCenter"] = 4] = "TopCenter";
    Alignment[Alignment["TopLeft"] = 5] = "TopLeft";
    Alignment[Alignment["TopRight"] = 6] = "TopRight";
    Alignment[Alignment["Unused2"] = 7] = "Unused2";
    Alignment[Alignment["BottomCenter"] = 8] = "BottomCenter";
    Alignment[Alignment["BottomLeft"] = 9] = "BottomLeft";
    Alignment[Alignment["BottomRight"] = 10] = "BottomRight";
})(Alignment || (Alignment = {}));
class SceneItem {
    name;
    scene;
    active = true;
    rotation;
    alignment;
    commands = [];
    transformFilterName;
    defaultSize;
    defaultPosition;
    defaultScale;
    defaultAlignment;
    currentPosition;
    currentSize;
    currentScale;
    constructor(props) {
        Object.assign(this, props);
        this.currentScale = this.defaultScale;
        this.currentSize = this.defaultSize;
        this.currentPosition = this.defaultPosition;
        this.alignment = this.defaultAlignment;
    }
    // Destructive action that returns the list of commands
    // to be ran by OBS to bring this scene up to date.
    getCommands() {
        return this.commands.splice(0, this.commands.length);
    }
    getTransform() {
        return {
            pos: this.currentPosition,
            rot: this.rotation,
            scale: this.currentScale,
        };
    }
    enableFilter(filterName) {
        this.commands.push({
            command: "SetSourceFilterEnabled",
            props: {
                sourceName: this.scene.name,
                filterName: filterName,
                filterEnabled: true
            }
        });
    }
    pushTransform() {
        this.commands.push({
            command: "SetSourceFilterSettings",
            props: {
                sourceName: this.scene.name,
                filterName: this.transformFilterName,
                filterSettings: this.getTransform()
            }
        });
    }
    reset() {
        this.rotation = 0;
        this.currentPosition = this.defaultPosition;
        this.currentScale = this.defaultScale;
        this.currentSize = this.defaultSize;
        this.alignment = this.defaultAlignment;
        this.setSceneItemTransform({
            alignment: this.alignment,
            height: this.defaultHeight(),
            width: this.defaultWidth(),
            positionX: this.defaultX(),
            positionY: this.defaultY(),
            scaleX: this.defaultScaleX(),
            scaleY: this.defaultScaleY()
        });
    }
    setSceneItemTransform(props) {
        this.commands.push({
            command: "SetSceneItemTransform",
            props: props
        });
    }
    scale(scaleX, scaleY) {
        this._scale(scaleX, scaleY ?? scaleX);
        this.pushTransform();
        this.enableFilter(this.transformFilterName);
    }
    // Private version of the Scale method used to do the
    // actual scaling logic. The public version of the method
    // only queues up the commands to be sent to OBS to perform
    // the actual scaling.
    _scale(scaleX, scaleY) {
        this.currentScale = {
            x: scaleX,
            y: scaleY ?? scaleX
        };
        this.currentSize = {
            height: this.defaultHeight() * this.scaleX(),
            width: this.defaultWidth() * this.scaleY(),
        };
    }
    rotate(angle) {
        this._rotate(angle);
        this.pushTransform();
        this.enableFilter(this.transformFilterName);
    }
    _rotate(angle) {
        this.rotation += angle;
        const isSideways = (angle % 180) == 90;
        const upsideDown = (angle % 360) >= 180;
        this._scale(isSideways ? (9 / 16) : 1);
        if (isSideways) {
            this.currentPosition = {
                x: upsideDown ? (this.defaultWidth() / 2) - (this.height() / 2) : (this.defaultWidth() / 2) + (this.height() / 2),
                y: 0
            };
        }
        else {
            this.currentPosition = {
                x: upsideDown ? this.defaultWidth() : this.currentPosition["x"],
                y: upsideDown ? this.defaultHeight() : this.currentPosition["y"]
            };
        }
    }
    height() {
        return this.currentSize["height"];
    }
    width() {
        return this.currentSize["width"];
    }
    defaultHeight() {
        return this.defaultSize["height"];
    }
    defaultWidth() {
        return this.defaultSize["width"];
    }
    defaultX() {
        return this.defaultPosition["x"];
    }
    defaultY() {
        return this.defaultPosition["y"];
    }
    defaultScaleX() {
        return this.defaultScale["x"];
    }
    defaultScaleY() {
        return this.defaultScale["y"];
    }
    scaleX() {
        return this.currentScale["x"];
    }
    scaleY() {
        return this.currentScale["y"];
    }
}
export { Alignment, SceneItem };
