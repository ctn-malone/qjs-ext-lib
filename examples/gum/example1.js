/** @format */
// @ts-check

import * as std from '../../src/std.js';

import { wait } from '../../src/timers.js';
import * as gum from '../../src/gum.js';
import { version } from '../../src/version.js';

/*
  Heavily inspired by https://github.com/charmbracelet/gum/blob/main/examples/demo.sh
 */

/** @type {string} */
let flavor;

/** @type {string} */
let name;

const abort = () => {
  console.log(
    `Too bad you don't want to keep chatting ${gum.format(':cry:', {
      type: 'emoji',
    })}`
  );
  std.exit(0);
};

const welcome = () => {
  console.log(
    gum.style(
      `Hello, there! Welcome to ${gum.style('Gum', {
        foreground: '212',
      })}`,
      {
        border: gum.Border.NORMAL,
        marginTop: 1,
        marginBottom: 1,
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 1,
        paddingBottom: 1,
        borderForeground: '212',
      }
    )
  );
};

const askName = async () => {
  const value = gum.input({
    placeholder: 'What is your name?',
  });
  if (!value) {
    return false;
  }
  name = value;
  console.log(
    `Well, it is nice to meet you, ${gum.style(value, {
      foreground: '212',
    })}.\n`
  );
  await wait(1500);
  return true;
};

const askSecret = async () => {
  gum.clear();
  let validateHelp = '';
  const gumVersion = gum.getVersion();
  if (version.lte('0.14.0', gumVersion)) {
    validateHelp = ` (validate with Ctrl-D)`;
  }
  console.log(
    `Could you tell me a ${gum.style('secret', {
      foreground: '99',
      italic: true,
    })} ?${validateHelp}\n`
  );
  const secret = gum.write({
    placeholder: `I'll keep it to myself, I promise!`,
  });
  if (!secret) {
    return false;
  }

  /**
   * @readonly
   * @enum {number}
   */
  const Action = {
    READ: 1,
    THINK: 2,
    DISCARD: 3,
  };
  const choices = gum.chooseItemsFromList(
    [
      { text: 'Read', value: Action.READ },
      { text: 'Think', value: Action.THINK },
      { text: 'Discard', value: Action.DISCARD },
    ],
    {
      header: 'What should I do with this information?',
      cursorPrefix: '[ ] ',
      selectedPrefix: '[✓] ',
    }
  );
  if (!choices) {
    return false;
  }

  gum.clear();
  console.log(`One moment, please.\n`);

  if (choices.find((e) => e.value === Action.READ)) {
    await gum.spin(wait(1000), {
      spinner: gum.Spinner.LINE,
      title: 'Reading the secret...',
    });
  }
  if (choices.find((e) => e.value === Action.THINK)) {
    await gum.spin(wait(1000), {
      spinner: gum.Spinner.PULSE,
      title: 'Thinking about your secret...',
    });
  }
  if (choices.find((e) => e.value === Action.DISCARD)) {
    await gum.spin(wait(1000), {
      spinner: gum.Spinner.MONKEY,
      title: 'Discarding your secret...',
    });
  }
  return true;
};

const askGumFlavor = async () => {
  gum.clear();
  /**
   * @readonly
   * @enum {number}
   */
  const Flavor = {
    CHERRY: 1,
    GRAPE: 2,
    LIME: 3,
    ORANGE: 4,
  };
  const choice = gum.filterItemFromList(
    [
      { text: 'Cherry', value: Flavor.CHERRY },
      { text: 'Grape', value: Flavor.GRAPE },
      { text: 'Lime', value: Flavor.LIME },
      { text: 'Orange', value: Flavor.ORANGE },
    ],
    {
      header: 'What is your favorite Gum flavor?',
      custom: {
        env: { GUM_FILTER_HEADER_FOREGROUND: '250' },
      },
    }
  );
  if (!choice) {
    return false;
  }
  flavor = choice.text;
  console.log(
    `I'll keep that in mind. I like ${gum.style(choice.text, {
      foreground: '212',
    })} too !`
  );
  await wait(1500);
  return true;
};

const askIfLikeBubbleGum = async () => {
  gum.clear();
  const like = gum.confirm({
    prompt: `Do you like ${gum.style('BubbleGum', {
      foreground: '#04B575',
    })}?`,
  });
  if (like) {
    console.log(
      `I thought so, ${gum.style('Bubble Gum', { bold: true })} is the best.\n`
    );
  } else {
    console.log(`I'm sorry to hear that.\n`);
  }
  await wait(500);

  await gum.spin(wait(2000), {
    spinner: gum.Spinner.PULSE,
    title: `Chewing some ${gum.style(flavor, {
      foreground: '#04B575',
    })} bubble gum...`,
  });
  return true;
};

const goodbye = async () => {
  gum.clear();
  const niceMeetingYou = gum.style(
    `Well, it was nice meeting you, ${gum.style(name, {
      foreground: '212',
    })}. Hope to see you soon!`,
    {
      height: 6,
      width: 25,
      paddingTop: 1,
      paddingBottom: 1,
      paddingLeft: 3,
      paddingRight: 3,
      border: gum.Border.DOUBLE,
      borderForeground: '57',
    }
  );
  const chewBubbleGum = gum.style(
    `Don't forget to chew some ${gum.style(flavor, {
      foreground: '#04B575',
    })} bubble gum.`,
    {
      height: 6,
      width: 25,
      paddingTop: 1,
      paddingBottom: 1,
      paddingLeft: 3,
      paddingRight: 3,
      border: gum.Border.DOUBLE,
      borderForeground: '212',
    }
  );
  console.log(gum.join([niceMeetingYou, chewBubbleGum]));
  await wait(500);
};

const main = async () => {
  if (!gum.hasGum()) {
    console.log(
      `Looks like gum binary is missing. You can download it from https://github.com/charmbracelet/gum.`
    );
    std.exit(1);
  }
  welcome();
  (await askName()) || abort();
  (await askSecret()) || abort();
  (await askGumFlavor()) || abort();
  await askIfLikeBubbleGum();
  await goodbye();
};

main();
