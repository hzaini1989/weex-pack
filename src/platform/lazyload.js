/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

// The URL:true below prevents jshint error "Redefinition or 'URL'."
/* globals URL:true */

const path = require('path');
const _ = require('underscore');
const fs = require('fs');
const platforms = require('./platforms');
const events = require('weexpack-common').events;
const config = require('./config');
const Q = require('q');
const npmhelper = require('./utils/npm-helper');
const tools = require('./utils/tools');

const stubplatform = {
  url: undefined,
  version: undefined,
  altplatform: undefined,
  subdirectory: ''
};

function Platform (platformString) {
  let name;
  let parts;
  let version;
  if (platformString.indexOf('@') !== -1) {
    parts = platformString.split('@');
    name = parts[0];
    version = parts[1];
  }
  else {
    name = platformString;
  }
  const platform = _.extend({}, platforms[name]);
  this.name = name;
  this.version = version || platform.version;
  this.packageName = 'weexpack-' + name;
  this.source = 'source' in platform ? platform.source : 'npm';
}

// Returns a promise for the path to the lazy-loaded directory.
function basedOnConfig (projectRoot, platform, opts) {
  const customPath = config.hasCustomPath(projectRoot, platform);
  if (customPath) {
    const dotFile = config.read(projectRoot);
    const mixedPlatforms = _.extend({}, platforms);
    mixedPlatforms[platform] = _.extend({}, mixedPlatforms[platform], dotFile.lib && dotFile.lib[platform] || {});
    return custom(mixedPlatforms, platform);
  }
  else {
    return download(platform, opts);
  }
}

// Returns a promise for the path to the lazy-loaded directory.
function download (platform, opts) {
  platform = new Platform(platform);
  const useGit = platform.source === 'git';
  if (useGit) {
    return gitHelper(platform);
  }
  else {
    return npmHelper(platform);
  }
}

function gitHelper (platform) {
  const mixedPlatforms = _.extend({}, platforms);
  if (!(platform.name in platforms)) {
    return Q.reject(new Error('weex library "' + platform.name + '" not recognized.'));
  }
  const plat = mixedPlatforms[platform.name];

  // We can't use a version range when getting from git, so if we have a range, find the latest release on npm that matches.
  return tools.getLatestMatchingNpmVersion(platform.packageName, platform.version).then(function (version) {
    plat.version = version;
    if (/^...*:/.test(plat.url)) {
      plat.url = plat.url + ';a=snapshot;h=' + version + ';sf=tgz';
    }
    return custom(mixedPlatforms, platform.name);
  });
}

function npmHelper (platform) {
  if (!(platform.name in platforms)) {
    return Q.reject(new Error('weex library "' + platform.name + '" not recognized.'));
  }
    // Check if this version was already downloaded from git, if yes, use that copy.
    // TODO: remove this once we fully switch to npm workflow.
    // If platform.version specifies a *range*, we need to determine what version we'll actually get from npm (the
    // latest version that matches the range) to know what local directory to look for.
  return tools.getLatestMatchingNpmVersion(platform.packageName, platform.version).then(function (version) {
        // Note that because the version of npm we use internally doesn't support caret versions, in order to allow them
        // from the command line and in config.xml, we use the actual version returned by getLatestMatchingNpmVersion().
    return npmhelper.cachePackage(platform.packageName, version);
  });
}

// Returns a promise for the path to the lazy-loaded directory.
function custom (platforms, platform) {
  let downloadDir;
  let libDir;
  if (!(platform in platforms)) {
    return Q.reject(new Error('weex library "' + platform + '" not recognized.'));
  }

  const plat = _.extend({}, stubplatform, platforms[platform]);
  const version = plat.version;
    // Older tools can still provide uri (as opposed to url) as part of extra
    // config to create, it should override the default url provided in
    // platfroms.js
  const url = plat.uri || plat.url;
  const id = plat.id;
  const subdir = plat.subdirectory;
  const platdir = plat.altplatform || platform;
    // Return early for already-cached remote URL, or for local URLs.
  const uri = URL.parse(url);
  console.log(uri)
  const isUri = uri.protocol && uri.protocol[1] !== ':'; // second part of conditional is for awesome windows support. fuuu windows
  if (isUri) {
    downloadDir = path.join(tools.libDirectory, platdir, id, version);
    libDir = path.join(downloadDir, subdir);
    if (fs.existsSync(downloadDir)) {
      events.emit('verbose', id + ' library for "' + platform + '" already exists. No need to download. Continuing.');
      return Q(libDir);
    }
  }
  else {
    // Local path.
    libDir = path.join(url, subdir);
    return Q(libDir);
  }
}

exports.download = download;
exports.gitHelper = gitHelper;
exports.npmHelper = npmHelper;
exports.custom = custom;
exports.basedOnConfig = basedOnConfig;
