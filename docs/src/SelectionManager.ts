// src/SelectionManager.ts
import { Actor } from "./Actor";

export class SelectionManager {
    selected: Actor | null = null;

    onChange: ((actor: Actor | null) => void) | null = null;

    select(actor: Actor | null) {
        this.selected = actor;
        if (this.onChange) this.onChange(actor);
    }


    isSelected(actor: Actor) {
        return this.selected === actor;
    }
}