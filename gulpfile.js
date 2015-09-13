
/*globals Buffer, __dirname, process*/


// Native Node Modules
var exec = require("child_process").exec;
var del = require("del");
var fs = require("fs");

// Gulp & Gulp Plugins
var gulp = require("gulp");
var gutil = require("gulp-util");
//var gulpif = require("gulp-if");
//var rename = require("gulp-rename");
var ts = require("gulp-typescript");
var tslint = require("gulp-tslint");
var typedoc = require("gulp-typedoc");
//var tar = require("gulp-tar");
//var gzip = require("gulp-gzip");
//var eol = require("gulp-eol");

// Other Modules
var runSequence = require("run-sequence");
var mocha = require("gulp-mocha");
//var bower = require("bower");
//var request = require("request");
//var sh = require("shelljs");
//var async = require("async");
//var xpath = require("xpath");
//var XmlDom = require("xmldom").DOMParser;
//var karma = require("karma").server;


var paths = {
    ts: ["./src/**/*.ts"],
    js: ["./js/**/*.*"],
    tsout : './js',
    //tests: ["./js/test/**/*.js"],
    tests: ["./js/test/Db3Tests.js"],
    remoteBuildFiles: [
        "./js/**",
        "package.json"
    ]
};

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
gulp.task("test", ["ts"], function (done) {
    return gulp.src(paths.tests, {read: false})
        // gulp-mocha needs filepaths so you can't have any plugins before it
        .pipe(mocha());
});

/**
 * Uses the tsd command to restore TypeScript definitions to the typings
 * directories and rebuild the tsd.d.ts typings bundle for both the app
 * as well as the unit tests.
 */
gulp.task("tsd", function (cb) {
    runSequence("tsd:app", "tsd:tests", cb);
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
 * Uses the tsd command to restore TypeScript definitions to the typings
 * directory and rebuild the tsd.d.ts typings bundle (for the unit tests).
 */
gulp.task("tsd:tests", function (cb) {
    // First reinstall any missing definitions to the typings-tests directory.
    exec("tsd reinstall --config tsd.tests.json", function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);

        if (err) {
            cb(err);
            return;
        }

        // Rebuild the tests/tsd.d.ts bundle reference file.
        exec("tsd rebundle --config tsd.tests.json", function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            cb(err);
        });
    });
});

/**
 * Used to generate the js/BuildVars.js file which contains information about
 * the build (such as version number, timestamp, and build scheme) as well as any
 * other variables that should be defined at build time (API URLs etc).
 * 
 * The version number is taken from the config.xml file.
 */
gulp.task("ts:vars", function (cb) {
    /*
    var configXml,
        configXmlDoc,
        majorVersion = 0,
        minorVersion = 0,
        buildVersion = 0,
        apiUrl;

    // Attempt to query and parse the version information from config.xml.
    // Default to 0.0.0 if there are any problems.
    try {
        configXml = fs.readFileSync("config.xml", "utf8");
        configXmlDoc = new XmlDom().parseFromString(configXml);
        var versionString = xpath.select1("/*[local-name() = 'widget']/@version", configXmlDoc).value;
        var versionParts = versionString.split(".");
        majorVersion = parseInt(versionParts[0], 10);
        minorVersion = parseInt(versionParts[1], 10);
        buildVersion = parseInt(versionParts[2], 10);
    }
    catch (err) {
        console.log("Error parsing version from config.xml; using 0.0.0 instead.", err);
    }

    try {
        configXml = fs.readFileSync('config.xml', 'utf8');
        configXmlDoc = new XmlDom().parseFromString(configXml);

        if (isDebugScheme()) {
            apiUrl = xpath.select1("/*[local-name() = 'widget']/*[local-name() = 'preference'][@name='ApiUrlDebug']/@value", configXmlDoc).value;
        }
        else {
            apiUrl = xpath.select1("/*[local-name() = 'widget']/*[local-name() = 'preference'][@name='ApiUrl']/@value", configXmlDoc).value;
        }
    }
    catch (err) {
        console.error("Unable to parse ApiUrl/ApiUrlDebug from the config.xml file.");
        cb(err);
    }

    // Create the structure of the buildVars variable.
    var buildVarsJson = JSON.stringify({
        majorVersion: majorVersion,
        minorVersion: minorVersion,
        buildVersion: buildVersion,
        debug: isDebugScheme(),
        buildTimestamp: (new Date()).toUTCString(),
        apiUrl: apiUrl
    });

    // Write the buildVars variable with code that will define it as a global object.
    var buildVarsJs = "window.buildVars = " + buildVarsJson  + ";";

    // Write the file out to disk.
    fs.writeFileSync("www/js/BuildVars.js", buildVarsJs, { encoding: "utf8" });
    */
    
    cb();
});

/**
 * Used to copy the entire TypeScript source into the www/js/src directory so that
 * it can be used for debugging purposes.
 * 
 * This will only copy the files if the build scheme is not set to release.
 */
gulp.task("ts:src", function (cb) {

    if (!isDebugScheme()) {
        cb();
        return;
    }

    return gulp.src(paths.ts)
        .pipe(gulp.dest("js"));
});

/**
 * Used to perform compliation of the TypeScript source in the src directory and
 * output the JavaScript to js/bundle.js. Compilation parameters are located
 * in src/tsconfig.json.
 * 
 * It will also delegate to the vars and src tasks to copy in the original source
 * which can be used for debugging purposes. This will only occur if the build scheme
 * is not set to release.
 */
gulp.task("ts", ["ts:vars", "ts:src"], function (cb) {
    var tsProject = ts.createProject('src/tsconfig.json', {
        typescript: require('typescript')
    });
    var tsResult = gulp.src(paths.ts)
        .pipe(ts(tsProject));
    return tsResult.js.pipe(gulp.dest(paths.tsout));
    /*
    exec("tsc -p src", function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
    */
});

/**
 * Used to perform compilation of the unit TypeScript tests in the tests directory
 * and output the JavaScript to tests/tests-bundle.js. Compilation parameters are
 * located in tests/tsconfig.json.
 * 
 * It will also delegate to the ts task to ensure that the application source is
 * compiled as well.
 */
/*
gulp.task("ts:tests", ["ts"], function (cb) {
    exec("tsc -p tests", function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
});
*/

/**
 * Used to perform a file clean-up of the project. This removes all files and directories
 * that don't need to be committed to source control by delegating to several of the clean
 * sub-tasks.
 */
gulp.task("clean", ["clean:tmp", "clean:node", "clean:ts", "clean:tsd"]);

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

        "tests/tsd.d.ts",
        "typings-tests/**/*.d.ts",
        "!typings-tests/custom/*.d.ts",
        // "typings-tests/**",
        // "!typings/custom/**"
    ], cb);
});
/**
 * An gulp task to create documentation for typescript.
 */
gulp.task("typedoc", function() {
    return gulp
        .src(paths.ts)
        .pipe(typedoc({
            module: "commonjs",
            target: "es5",
            out: "docs/",
            name: "JSDB"
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
