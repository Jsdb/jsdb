import Tsdb = require('../main/Tsdb');

export = ForwardWrong;
module ForwardWrong {
	export class A {
		@Tsdb.embedded(B)
		prop :B;
	}
	export class B {
		
	}
}