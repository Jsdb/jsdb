module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg : grunt.file.readJSON('package.json'),
		dts_bundle : {
			build : {
				options : {
					name : '<%= pkg.name %>',
					main : 'js/main/Db.d.ts'
				}
			}
		},
		clean : {
			coverage : {
				src : [ 'coverage/' ]
			}
		},
		copy : {
			coverage : {
				cwd: 'js',
				expand: true,
				src : [ 'test/**' ],
				dest : 'coverage/'
			}
		},
		blanket : {
			coverage : {
				src : [ 'js/main' ],
				dest : 'coverage/main/'
			}
		},
		mochaTest : {
			test : {
				options : {
					reporter : 'spec',
				},
				src : [ 'coverage/test/**/*.js' ]
			},
			coverage : {
				options : {
					reporter : 'html-cov',
					quiet : true,
					captureFile : 'coverage/coverage.html'
				},
				src : [ 'coverage/test/**/*.js' ]
			}
		}
	});

	grunt.loadNpmTasks('grunt-dts-bundle');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-blanket');

	grunt.registerTask('test', [ 'clean', 'blanket', 'copy', 'mochaTest' ]);
	grunt.registerTask('default', [ 'test', 'dts_bundle' ]);
};
