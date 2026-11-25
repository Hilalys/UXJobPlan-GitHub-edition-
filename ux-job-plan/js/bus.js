// Tiny shared hooks so modules can ask the app to redraw without import cycles.
export const bus = { render() {}, timer() {} };
