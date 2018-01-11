#!/usr/bin/env node

const program = require('commander');
const logger = require('weexpack-common').CordovaLogger.get();

const {
  install,
  uninstall,
  installForNewPlatform,
  create
} = require('../src/plugin');

process.on('uncaughtException', (err) => {
  logger.error(err.stack)
});
process.on('unhandledRejection', (err) => {
  logger.error(err.stack);
});

program
.command('create [plugin_name]')
.description('create a empty plugin project')
.action(function (pluginName) {
  if (pluginName.match(/^[$A-Z_][0-9A-Z_-]*$/i)) {
    create(pluginName, program.argv)
  } else {
    console.log(`\n${chalk.red('Invalid plugin name:')} ${chalk.yellow(pluginName)}`);
    process.exit();
  }
});

program
  .command('add [plugin_name]')
  .description('Add a plugin into you project')
  .action(function (pluginName) {
    return install(pluginName, program.argv);
  });


program
  .command('remove [plugin_name]')
  .description('Remove a plugin into you project')
  .action(function (pluginName) {
    return uninstall(pluginName, program.argv);
  });

program
  .command('install [platformName]')
  .description('Install plugins into you project')
  .action(function (platformName) {
    if (platformName) {
      return installForNewPlatform(platformName)
    }
    return installForNewPlatform(['web', 'ios', 'android']);
  });

program.parse(process.argv);
