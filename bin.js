#!/usr/bin/env node

var path = require('path')
var log = require('npmlog')
var fs = require('fs')
var async = require('async')

var rc = require('./rc')
var download = require('./download')
var prebuild = require('./prebuild')
var build = require('./build')
var upload = require('./upload')

if (rc.path) process.chdir(rc.path)

if (rc.version) {
  console.log(require('./package.json').version)
  process.exit(0)
}

log.heading = 'prebuild'
if (process.env.npm_config_loglevel && !rc.verbose) log.level = process.env.npm_config_loglevel

if (!fs.existsSync('package.json')) {
  log.error('setup', 'No package.json found. Aborting...')
  process.exit(1)
}

var pkg = require(path.resolve('package.json'))

if (rc.help) {
  console.error(fs.readFileSync(path.join(__dirname, 'help.txt'), 'utf-8'))
  process.exit(0)
}

var buildLog = log.info.bind(log, 'build')
var opts = {pkg: pkg, rc: rc, log: log, buildLog: buildLog}

if (rc.compile) return build(opts, process.version, onbuilderror)

if (rc.download) {
  return download({pkg: pkg, rc: rc, log: log}, function (err) {
    if (err) {
      log.warn('install', err.message)
      log.info('install', 'We will now try to compile from source.')
      return build(opts, process.version, onbuilderror)
    }
    log.info('install', 'Prebuild successfully installed!')
  })
}

var files = []
async.eachSeries([].concat(rc.target), function (target, next) {
  prebuild(opts, target, function (err, tarGz) {
    if (err) return next(err)
    files.push(tarGz)
    next()
  })
}, function (err) {
  if (err) return onbuilderror(err)
  if (!rc.upload) return
  buildLog('Uploading ' + files.length + ' prebuilds(s) to Github releases')
  upload({pkg: pkg, rc: rc, files: files}, function (err, result) {
    if (err) return onbuilderror(err)
    buildLog('Found ' + result.old.length + ' prebuild(s) on Github')
    if (result.old.length) {
      result.old.forEach(function (build) {
        buildLog('-> ' + build)
      })
    }
    buildLog('Uploaded ' + result.new.length + ' new prebuild(s) to Github')
    if (result.new.length) {
      result.new.forEach(function (build) {
        buildLog('-> ' + build)
      })
    }
  })
})

function onbuilderror (err) {
  if (!err) return
  log.error('build', err.message)
  process.exit(2)
}
