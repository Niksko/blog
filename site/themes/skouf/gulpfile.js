'use strict';

// モジュール読み込み
const gulp = require('gulp');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');

// オプション
const sassOptions = {
  options: {
    outputStyle: 'compressed',
    sourceMap: false,
    sourceComment: false
  }
};

const autoprefixerOptions = {
  options: {
    browsers: ['last 3 version', 'ie >= 9', 'Android 4.0']
  }
};

// 各タスク読み込み
gulp.task('style', function(){
  const src = './src/scss/**/*.scss';
  const dest = './static/css';
  return gulp.src(src)
    .pipe(plumber({
      errorHandler: notify.onError('Error: <%= error.message %>')
    }))
    .pipe(sass(sassOptions))
    .pipe(autoprefixer(autoprefixerOptions))
    .pipe(gulp.dest(dest));
});

// デフォルトタスク
gulp.task('default', gulp.series(function(){
  gulp.watch('./src/scss/**/*.scss', gulp.series('style'));
}));
