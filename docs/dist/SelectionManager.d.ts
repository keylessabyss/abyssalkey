import { Actor } from "./Actor";
export declare class SelectionManager {
    selected: Actor | null;
    onChange: ((actor: Actor | null) => void) | null;
    select(actor: Actor | null): void;
    isSelected(actor: Actor): boolean;
}
//# sourceMappingURL=SelectionManager.d.ts.map