var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../main/Tsdb'], function (require, exports) {
    var Tsdb = require('../main/Tsdb');
    var ForwardWrong;
    (function (ForwardWrong) {
        var A = (function () {
            function A() {
            }
            __decorate([
                Tsdb.embedded(B)
            ], A.prototype, "prop");
            return A;
        })();
        ForwardWrong.A = A;
        var B = (function () {
            function B() {
            }
            return B;
        })();
        ForwardWrong.B = B;
    })(ForwardWrong || (ForwardWrong = {}));
    return ForwardWrong;
});

//# sourceMappingURL=Db3ForwardWrong.js.map
