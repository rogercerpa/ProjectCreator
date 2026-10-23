/**
 * Defer loading a module until it is first used. Several document/archive
 * libraries take hundreds of milliseconds to load and are only needed by a
 * handful of actions, so loading them eagerly slows every app launch.
 *
 * The returned proxy forwards property access, calls (`officegen('docx')`) and
 * `new` to the real module once it has been loaded.
 */
function lazyRequire(moduleId) {
  let loaded;
  const load = () => {
    if (loaded === undefined) loaded = require(moduleId);
    return loaded;
  };

  return new Proxy(function lazyModule() {}, {
    get: (_target, prop) => load()[prop],
    has: (_target, prop) => prop in load(),
    apply: (_target, thisArg, args) => Reflect.apply(load(), thisArg, args),
    construct: (_target, args) => Reflect.construct(load(), args)
  });
}

module.exports = lazyRequire;
