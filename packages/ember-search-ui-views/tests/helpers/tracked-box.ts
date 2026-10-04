import { tracked } from '@glimmer/tracking';

/** A tracked value for driving re-renders from tests (replaces `this.set`). */
export class Box<T> {
  @tracked value: T;
  constructor(value: T) {
    this.value = value;
  }
}
