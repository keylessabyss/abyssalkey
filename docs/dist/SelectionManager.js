// src/SelectionManager.ts
import { Actor } from "./Actor";
export class SelectionManager {
    selected = null;
    onChange = null;
    select(actor) {
        this.selected = actor;
        if (this.onChange)
            this.onChange(actor);
    }
    isSelected(actor) {
        return this.selected === actor;
    }
}
//# sourceMappingURL=SelectionManager.js.map