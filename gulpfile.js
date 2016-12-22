var gulp = require('gulp');
var watch = require('gulp-watch');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var cleanCSS = require('gulp-clean-css');

gulp.task('sass', function () {
  return gulp.src(['./sass/**/*.scss', '!./sass/mq-templates/*.scss'])
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer('last 2 versions'))
    .pipe(gulp.dest('./css'));
});

gulp.task('sass', function () {
  return gulp.src(['./src/sass/style.scss'])
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer('last 2 versions'))
    .pipe(cleanCSS())
    .pipe(gulp.dest('./public'));
});

gulp.task('watch', function () {
  watch(['./src/sass/style.scss'], function () {
    gulp.start(['sass']);
  });
});

gulp.task('default', ['sass', 'watch']);
