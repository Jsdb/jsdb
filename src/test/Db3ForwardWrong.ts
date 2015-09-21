import Tsdb = require('../main/Db3');

export = ForwardWrong;
module ForwardWrong {
	export class A {
		@Tsdb.embedded(B)
		prop :B;
	}
	export class B {
		
	}
}