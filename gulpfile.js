
/*globals Buffer, __dirname, process*/


// Native Node Modules
var exec = require("child_process").exec;
var del = require("del");
var fs = require("fs");

// Gulp & Gulp Plugins
var gulp = require("gulp");
var merge = require('merge2');
var gutil = require("gulp-util");
var ts = require("gulp-typescript");
var sourcemaps = require('gulp-sourcemaps');
var path = require('path');
var dts = require('dts-bundle');
var tslint = require("gulp-tslint");
var typedoc = require("gulp-typedoc");
var wait = require('gulp-wait');
// Other Modules
var runSequence = require("run-sequence");
var mocha = require("gulp-mocha");
var spawnMocha = require("gulp-spawn-mocha");
var istanbul = require('gulp-istanbul');
var replace = require('gulp-replace');
var moment = require('moment');
var execSync = require('sync-exec');

var packg = {};
try {
	packg = JSON.parse(fs.readFileSync('./package.json'));
} catch (e) {
	console.log("Error reading package.json");
	console.log(e);
}
var gulpdata = (packg && packg.gulp_data) ? packg.gulp_data : {}; 

var NAME = gulpdata.fullName || packg.name || 'project';
var CODENAME = gulpdata.codeName || packg.name || 'project';


var paths = {
	tests: ['./js/test/**/*.js'],
	mainDts: './js/main/index.d.ts',
	ts: ['./src/**/*.ts'],
	js: ['./js/**/*.js'],
	jsApp: ['./js/main/**/*.js'],
	jsTest: ['.js/test/**/*.js'],
	tsout: './js',
	tsoutApp: './js/main',
	tsApp: ['./src/main/**/*.ts'],
	tsTest: ['./src/test/**/*.ts'],
};

if (packg && packg.gulp_data && packg.gulp_data.paths) {
	var gdpaths = packg.gulp_data.paths;
	var ks = Object.keys(paths);
	for (var i = 0; i < ks.length; i++) {
		var k = ks[i];
		if (gdpaths.hasOwnProperty(k)) {
			paths[k] = gdpaths[k];
		}
	}
}

/**
 * Used to determine if the gulp operation was launched for a debug or release build.
 * This is controlled by the scheme parameter, if no scheme is provided, it will default
 * to debug. For example, to specify release build for the ts task you"d use:
 * 
 * gulp ts --scheme release
 */
function isDebugScheme() {
	return gutil.env.scheme === "release" ? false : true;
}

/**
 * A custom reporter for the TypeScript linter reporter function. This was copied
 * and modified from gulp-tslint.
 */
function logTsError(message, level) {
	var prefix = "[" + gutil.colors.cyan("gulp-tslint") + "]";

	if (level === "error") {
		gutil.log(prefix, gutil.colors.red("error"), message);
	} else if (level === "warn") {
		gutil.log(prefix, gutil.colors.yellow("warn"), message);
	} else {
		gutil.log(prefix, message);
	}
}

/**
 * A custom reporter for the TypeScript linter so we can pass "warn" instead of
 * "error" to be recognized by Visual Studio Code"s pattern matcher as warnings
 * instead of errors. This was copied and modified from gulp-tslint.
 */
var tsLintReporter = function(failures, file) {
	failures.forEach(function(failure) {
		// line + 1 because TSLint"s first line and character is 0
		logTsError("(" + failure.ruleName + ") " + file.path +
			"[" + (failure.startPosition.line + 1) + ", " +
			(failure.startPosition.character + 1) + "]: " +
			failure.failure, "warn");
	});
};

/**
 * Helper used to pipe an arbitrary string value into a file.
 * 
 * http://stackoverflow.com/a/23398200/4005811
 */
function string_src(filename, str) {
	var src = require("stream").Readable({ objectMode: true });

	src._read = function () {
		this.push(new gutil.File({ cwd: "", base: "", path: filename, contents: new Buffer(str) }));
		this.push(null);
	};

	return src;
}

/**
 * Used to format a string by replacing values with the given arguments.
 * Arguments should be provided in the format of {x} where x is the index
 * of the argument to be replaced corresponding to the arguments given.
 * 
 * For example, the string t = "Hello there {0}, it is {1} to meet you!"
 * used like this: Utilities.format(t, "dude", "nice") would result in:
 * "Hello there dude, it is nice to meet you!".
 * 
 * @param str The string value to use for formatting.
 * @param args The values to inject into the format string.
 */
function format(formatString) {
	var i, reg;
	i = 0;

	for (i = 0; i < arguments.length - 1; i += 1) {
		reg = new RegExp("\\{" + i + "\\}", "gm");
		formatString = formatString.replace(reg, arguments[i + 1]);
	}

	return formatString;
}


var lastVersionTag = '';
/**
 * Used to replace VERSION_TAG in compiled files with current git version and timestamp
 */
function versionTag() {
	if (lastVersionTag) return lastVersionTag;
	var gitVer = '';
	var gitBranch = 'local';
	try {
		gitVer = execSync('git log -1 --pretty=%h').stdout.trim();
		gitBranch = execSync('git rev-parse --abbrev-ref HEAD').stdout.trim();
	} catch (e) {
	}
	gitVer = packg.version + '_' + gitVer;
	var ts = moment().format('YYYYMMDD_HHmmss');
	lastVersionTag = ts + '_' + gitBranch + '_' + gitVer;
	return lastVersionTag;
}


/**
 * The default task downloads TypeScript definitions,
 * and then lints and builds the TypeScript source code.
 */
gulp.task("default", function (cb) {
	runSequence("tsd", "ts", cb);
});

/**
 * The watch task will watch for any changes in the TypeScript files and re-execute the
 * ts gulp task if they change. 
 */
gulp.task("watch", function() {
	gulp.watch(paths.ts, ["ts"]);
});

/**
 * Performs linting of the TypeScript source code.
 */
gulp.task("lint", function (cb) {
	var filesToLint = paths.ts.concat(paths.tests);

	return gulp.src(filesToLint)
	.pipe(tslint())
	.pipe(tslint.report(tsLintReporter));
});

/**
 * Run all of the unit tests once and then exit.
 */
gulp.task("test", function (cb) {
	gulp.src(paths.jsApp)
		.pipe(wait(5000))
		.pipe(replace('var __decorate =','/* istanbul ignore next */ var __decorate ='))
		.pipe(replace('var __extends =','/* istanbul ignore next */ var __extends ='))
		.pipe(istanbul()) // Covering files
		.pipe(istanbul.hookRequire()) // Force `require` to return covered files
		.on('finish', function () {
			gulp.src(paths.tests)
			.pipe(mocha())
			.pipe(istanbul.writeReports()) // Creating the reports after tests ran
			.pipe(istanbul.enforceThresholds({ thresholds: { global: 70 } })) // Enforce a coverage of at least 90%
			.on('end', cb);
		});
});

/**
 * Run mocha with debug on, without other things active
 */
gulp.task("test:debug", ["ts"], function (cb) {
	gulp.src(paths.tests)
		.pipe(spawnMocha({debugBrk:true}))
		.on('end', cb);
});

/**
 * Run mocha without coverage instrumentation
 */
gulp.task("test:clean", ["ts"], function (cb) {
	gulp.src(paths.tests)
		.pipe(spawnMocha())
		.on('end', cb);
});

/**
 * Uses the tsd command to restore TypeScript definitions to the typings
 * directories and rebuild the tsd.d.ts typings bundle for both the app
 * as well as the unit tests.
 */
gulp.task("tsd", function (cb) {
	runSequence("tsd:app", cb);
});

/**
 * Uses the tsd command to restore TypeScript definitions to the typings
 * directory and rebuild the tsd.d.ts typings bundle (for the app).
 */
gulp.task("tsd:app", function (cb) {
	// First reinstall any missing definitions to the typings directory.
	exec("tsd reinstall", function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);

		if (err) {
			cb(err);
			return;
		}

		// Rebuild the src/tsd.d.ts bundle reference file.
		exec("tsd rebundle", function (err, stdout, stderr) {
			console.log(stdout);
			console.log(stderr);
			cb(err);
		});
	});
});

/**
 * Used to copy the entire TypeScript source into the www/js/src directory so that
 * it can be used for debugging purposes.
 * 
 * This will only copy the files if the build scheme is not set to release.
 */
gulp.task("ts:src", function (cb) {
	/*
	if (!isDebugScheme()) {
		cb();
		return;
	}

	return gulp.src(paths.ts)
		.pipe(gulp.dest("js"));
	*/
	cb();
});

/*
var UMDDef = '' + 
'    else if (typeof define === \'function\' && define.amd) {\n'+
'        define(deps, factory);\n'+
'    };';
*/
var UMDDef = /else if \(typeof define[^}]*}/;
var UMDGlobal = ''+
'    else if (typeof define === \'function\' && define.amd) {\n'+
'        define(deps, factory);\n'+
'    } else {\n'+
'        var glb = typeof window !== \'undefined\' ? window : global;\n'+
'        glb[\'Tsdb\'] = factory(null, {});\n'+
'    }\n';
var UMDGlobalMock = ''+
'    else if (typeof define === \'function\' && define.amd) {\n'+
'        define(deps, factory);\n'+
'    } else {\n'+
'        var glb = typeof window !== \'undefined\' ? window : global;\n'+
'        glb[\'Db3Mock\'] = factory(null, {});\n'+
'    }\n';


/**
 * Used to perform compliation of the TypeScript source in the src directory and
 * output the JavaScript to js/bundle.js. Compilation parameters are located
 * in src/tsconfig.json.
 * 
 * It will also delegate to the vars and src tasks to copy in the original source
 * which can be used for debugging purposes. This will only occur if the build scheme
 * is not set to release.
 */
gulp.task("ts", ["ts:src"], function () {
	var tsProject = ts.createProject('src/tsconfig.json', {
		typescript: require('typescript')
	});
	var tsResult = gulp.src(paths.ts, {base:'./src/'})
		.pipe(sourcemaps.init())
		.pipe(ts(tsProject));
	
	var srcRoot = process.cwd() + '/src/';
	return merge([
	tsResult.js
		.pipe(replace('VERSION_TAG', versionTag()))
		.pipe(sourcemaps.write('.',{
			includeContent:false,
			sourceRoot: function(file) {
				//console.log(process.cwd());
				//console.log(file.relative);
				//console.log(file.base);
				//console.log(file.cwd);
				var jsdir = process.cwd() + '/js/' + file.relative;
				jsdir = path.resolve(jsdir, '..');
				//console.log(jsdir);
				var relroot = path.relative(jsdir, srcRoot); 
				//console.log(relroot);
				return relroot;
			}
		}))
		.pipe(gulp.dest(paths.tsout))
		.on('finish', function() {
			gulp.src(paths.tsout + '/main/Tsdb.js', {base: './'})
				.pipe(replace(UMDDef,UMDGlobal))
				.pipe(gulp.dest('./'))
			gulp.src(paths.tsout + '/main/Db3Mock.js', {base: './'})
				.pipe(replace(UMDDef,UMDGlobalMock))
				.pipe(gulp.dest('./'))
		})
	,
	tsResult.dts
		.pipe(replace('VERSION_TAG', versionTag()))
		.pipe(replace(/.*reference path.*/g,''))
		.pipe(gulp.dest(paths.tsout))
		.on('finish', function() {
			if (paths.mainDts) {
				dts.bundle({
					name: CODENAME,
					main: paths.mainDts,
					out: CODENAME + '.d.ts'
				});
			}
			gulp.src(paths.tsout + '/main/Tsdb.d.ts', {base: './'})
				.pipe(replace('export = Tsdb;',''))
				.pipe(gulp.dest('./'));
		})
	]);
});


/**
 * Used to perform a file clean-up of the project. This removes all files and directories
 * that don't need to be committed to source control by delegating to several of the clean
 * sub-tasks.
 */
gulp.task("clean", ["clean:tmp", "clean:ts", "clean:tsd"]);

/**
 * Removes the tmp directory.
 */
gulp.task("clean:tmp", function (cb) {
	del([
		"tmp"
	], cb);
});

/**
 * Removes the node_modules directory.
 */
gulp.task("clean:node", function (cb) {
	del([
		"node_modules"
	], cb);
});

/**
 * Removes files related to TypeScript compilation.
 */
gulp.task("clean:ts", function (cb) {
	del([
		"js/**/*",
	], cb);
});

/**
 * Removes files related to TypeScript definitions.
 */
gulp.task("clean:tsd", function (cb) {

	// TODO: These patterns don't actually remove the sub-directories
	// located in the typings directories, they leave the directories
	// but remove the *.d.ts files. The following glob should work for
	// remove directories and preserving the custom directory, but they
	// don't for some reason and the custom directory is always removed:
	// "typings/**"
	// "!typings/custom/**"

	del([
		"src/tsd.d.ts",
		"typings/**/*.d.ts",
		"!typings/custom/*.d.ts",
		// "typings/**",
		// "!typings/custom/**",
	], cb);
});
/**
 * An gulp task to create documentation for typescript.
 */
gulp.task("typedoc", function() {
	return gulp
		.src(paths.tsApp)
		.pipe(typedoc({
			module: "commonjs",
			experimentalDecorators: true,
			excludeExternals: true,
			includeDeclarations: false,
			target: "es5",
			out: "docs/",
			name: NAME + ' ' + versionTag()
		}));
});

/**
 * Removes the docs directory.
 */
gulp.task("clean:typedoc", function (cb) {
	del([
		"docs"
	], cb);
});
