var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
var Tsdb = require('../main/Db3');
var ForwardWrong;
(function (ForwardWrong) {
    var A = (function () {
        function A() {
        }
        __decorate([
            Tsdb.embedded(function () { return B; })
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
module.exports = ForwardWrong;
