/** English. */

import type { Dict } from './pt';

export const en: Dict = {
  'nav.geradores': 'Generators',
  'nav.atividade': 'Activity',
  'nav.config': 'Settings',

  'common.exportCsv': 'Export CSV',
  'common.start': 'Start',
  'common.startLabel': 'started',
  'common.produced': 'produced',
  'common.toStart': 'Go to the top',
  'common.toEnd': 'Go to the end',

  'mode.title': 'Game mode',
  'mode.manual': 'Manual',
  'mode.auto': 'Automatic',
  'mode.hintAuto':
    'The game buys the highest-tier generator you can afford on its own: unlocking the next one or stacking the highest you already have.',
  'mode.hintManual': 'You make every purchase yourself.',

  'gen.autoToggle': 'Auto: {state}',
  'gen.baseNumber': 'base number',
  'gen.owns': 'owns',
  'gen.produces': 'produces {target}',

  'activity.empty': 'No unlocks recorded in {game} mode yet.',
  'activity.cta': 'Start playing {game}',
  'activity.unlocked': 'generators unlocked',
  'activity.playTime': 'play time',
  'activity.avgInterval': 'average of “time since previous”',
  'activity.sinceLast': 'since the last one',
  'activity.generator': 'Generator {n}',
  'activity.unlockedWith': 'unlocked at',
  'activity.ofPlay': '{time} of play',
  'activity.prevTier': 'previous tier owned',
  'activity.sincePrev': 'time since previous',
  'activity.gameStart': 'game start',
  'activity.pace': 'pace vs. previous unlock',
  'activity.samePace': 'same pace',
  'activity.slower': 'slower',
  'activity.faster': 'faster',

  'fps.production': 'production',
  'fps.max': 'max',
  'fps.newVersion': 'New version pending',

  'tab.saves': 'Saves',
  'tab.temas': 'Themes',
  'tab.som': 'Sound',
  'tab.video': 'Video',
  'tab.idioma': 'Language',

  'saves.title': 'Saves',
  'saves.hint': 'Your saved games.',
  'saves.active': 'active',
  'saves.load': 'Load save',
  'saves.reset': 'Reset {game}',
  'saves.rename': 'Rename',
  'saves.create': 'Create new save +',
  'saves.confirmCreate': 'Create',
  'saves.cancel': 'Cancel',
  'saves.deleteAria': 'Delete {name}',
  'saves.nameAria': 'Name of {name}',
  'saves.newNameAria': 'New save name',
  'saves.defaultName': 'Save {n}',
  'saves.noData': 'no data',

  'themes.title': 'Themes',
  'themes.hint': 'Theme library.',
  'themes.active': 'active theme',
  'themes.available': 'available',
  'theme.neutro': 'Neutral dark',
  'theme.midnight': 'Midnight blue',
  'theme.creme': 'Terracotta cream',
  'theme.verde': 'Moss green',

  'sound.title': 'Sound',
  'sound.hint': 'Button click sound.',
  'sound.enabled': 'Sound',
  'sound.volumeAria': 'Button sound volume',

  'video.title': 'Video',
  'video.hint': 'Display options.',
  'video.all': 'All cards',
  'video.individual': 'individual cards',
  'video.fps': 'FPS',
  'video.frameTime': 'Frame time',
  'video.battery': 'Battery',
  'video.memory': 'Memory',
  'video.domNodes': 'DOM nodes',

  'lang.title': 'Language',
  'lang.hint': 'Select the language.',

  'config.reset': 'Restore defaults',
  'config.resetWarn':
    'Restore themes, sound, video and language to their defaults? Your saved games are not affected.',
  'config.resetConfirm': 'Restore',

  'fullscreen.enter': 'Fullscreen',
  'fullscreen.exit': 'Exit fullscreen',
};
