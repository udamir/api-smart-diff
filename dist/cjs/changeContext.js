"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeContext = void 0;
class ChangeContext {
    get before() {
        return this._engine.resolvePath("before", this._path);
    }
    get after() {
        const renamedPath = this._engine.getRenamedPath(this._path);
        return this._engine.resolvePath("after", renamedPath);
    }
    get up() {
        return (n = 1) => new ChangeContext(this._engine, this._path.slice(0, -n));
    }
    get root() {
        return new ChangeContext(this._engine, []);
    }
    constructor(engine, path) {
        this._engine = engine;
        this._path = path;
    }
}
exports.ChangeContext = ChangeContext;
//# sourceMappingURL=changeContext.js.map