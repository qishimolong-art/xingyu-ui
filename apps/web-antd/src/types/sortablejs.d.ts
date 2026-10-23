declare module 'sortablejs' {
  export interface SortableEvent {
    item: HTMLElement;
    newDraggableIndex?: number;
    newIndex?: number;
    oldDraggableIndex?: number;
    oldIndex?: number;
    to: HTMLElement;
  }

  export interface MoveEvent extends SortableEvent {
    dragged: HTMLElement;
    related: HTMLElement;
  }

  export interface SortableOptions {
    [key: string]: any;
    animation?: number;
    delay?: number;
    draggable?: string;
    filter?:
      | string
      | ((event: Event, target: HTMLElement, sortable: Sortable) => boolean);
    handle?: string;
    onEnd?: (event: SortableEvent) => void;
    onMove?: (event: MoveEvent, originalEvent: Event) => boolean | void;
  }

  export default class Sortable {
    static create(el: HTMLElement, options?: SortableOptions): Sortable;
    destroy(): void;
  }
}
