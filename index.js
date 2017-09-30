'use strict';
let http = require('http');
let Alexa = require('alexa-sdk');
let tarotAPI = "tarotreader-179104.appspot.com";

const handlers = {
  'LaunchRequest': function () {
      this.emit(':tell', 'Welcome to Tarot Reader!');
  },
  'AMAZON.HelpIntent': function () {
      this.emit(':tell', 'help');
  },
  'AMAZON.CancelIntent': function () {
      this.emit(':tell', 'cancel');
  },
  'AMAZON.StopIntent': function () {
      this.emit(':tell', 'stop');
  },
  'ReadFortuneIntent': function() {
    let readingType = this.event.request.intent.slots.readingslot.value;
    let numCards;

    switch(readingType) {
        case "1 card":
            numCards = 1;
            break;
        case "3 card":
            numCards = 3;
            break;
        case "5 card":
            numCards = 5;
            break;
        default:
            numCards = 1;
            break;
    }

    let options = getTarotSpread(numCards);

    console.log(options);
    makeRequest(options, (data, error) => {
        if (data) {
            console.log(data);
            let { cards, spreadImg } = data.spread;
            let cardKeywords = [];
            let speech = "";
            let text = "";
            let positions;

            cards.forEach(card => {
                let { orientation } = card;
                cardKeywords.push({
                    "title": `${card.name} (${orientation})`,
                    "value": card.keywords[orientation].join(', '),
                    "short": true
                });
            });

            switch(cards.length) {
                case 1:
                    text = `You drew the ${cards[0].name} (${cards[0].orientation}).`;
                    speech = text + formatSpeech(cards[0]);
                    break;
                case 3:
                    text = `The card representing your past is the ${cards[0].name} ` + 
                        `(${cards[0].orientation}). The card indicative of your present situation ` + 
                        `is the ${cards[1].name} (${cards[1].orientation}). The card depicting ` + 
                        `your future is the ${cards[2].name} (${cards[2].orientation}).`;
                    positions = ["your past", "the present", "the future"];
                    for(let i=0; i<3; i++) {
                        speech = speech + ' ' + formatSpeech(cards[i], positions[i]);
                    }
                    break;
                case 5:
                    text = `The challenge facing you: the ${cards[0].name} (${cards[0].orientation}). ` + 
                        `Your past: the ${cards[1].name} (${cards[1].orientation}). ` + 
                        `The present: the ${cards[2].name} (${cards[2].orientation}). ` + 
                        `The future: the ${cards[3].name} (${cards[3].orientation}). ` + 
                        `Your possibilities: the ${cards[4].name} (${cards[4].orientation}). `;
                    positions = ["the challenge facing you", "your past", 
                        "the present", "the future", "your possibilities"];
                    for(let i=0; i<5; i++) {
                        speech = speech + ' ' + formatSpeech(cards[i], positions[i]);
                    }
                    break;
                default:
                    text = `You drew the ${cards[0].name} ${cards[0].orientation}.`;
                    speech = text + formatSpeech(cards[0]);
                    break;
            }

            let cardTitle = `Your ${readingType} Reading`;
            let cardContent = "";
            let imageObject = {
              smallImageUrl: spreadImg,
              largeImageUrl: spreadImg
            };

            this.emit(':tellWithCard', speech, cardTitle, cardContent, imageObject);
        } else {
            this.emit(':tell', 'I\'m not sure!');
        }
    });
  },
  'ClarifyIntent': function() {
    let slots = this.event.request.intent.slots;
    let cardName = digitToWord(slots.cardslot.value);
    if (slots.suitslot.value) {
      cardName = cardName.concat(' of ' + slots.suitslot.value);
    }
    cardName = capitalizeText(cardName);
    let options = searchCardsByName(cardName);

    makeRequest(options, (data, error) => {
        if (data) {
            let response = '';
            if (slots.orientationslot.value.toLowerCase() === 'reversed') {
                response = data.readings.reversed;
            }else{
                response = data.readings.upright;
            }
            response = response.split('\n');
            response = response[Math.floor(Math.random()*response.length)];
            this.emit(':tell', response);
        } else {
            this.emit(':tell', 'I\'m not sure!');
        }
    });
  },
  'DescribeIntent': function() {
      let slots = this.event.request.intent.slots;
      let cardName = digitToWord(slots.cardslot.value);
      if (slots.suitslot.value) {
        cardName = cardName.concat(' of ' + slots.suitslot.value);
      }
      cardName = capitalizeText(cardName);

      let options = searchCardsByName(cardName);

      makeRequest(options, (data, error) => {
          if (data) {
            let response = data.description;
            this.emit(':tell', response);
          } else {
            this.emit(':tell', 'I\'m not sure!');
          }
      });
  },
};

function getTarotSpread(numCards) {
  return {
      host: tarotAPI,
      path: `/api/cards/spread?numCards=${numCards}`
  };
}

function searchCardsByName(cardName) {
  // escape spaces before appending cardName to query string
  cardName = cardName.replace('The ', '');
  cardName = cardName.replace(/ /g,'%20');
  console.log(cardName);
  return {
      host: tarotAPI,
      path: `/api/cards/findOne?filter[where][name]=${cardName}`
  };
}

function formatSpeech(card, position) {
  let keys = card.keywords[card.orientation];
  let name = `${card.name} (${card.orientation})`;

  keys = keys.slice(0, -1).join(', ') + ', and' + keys.slice(-1);
  if (position) {
      return `The card representing ${position} is the ${name}. 
          The ${name} is associated with ${keys}`;
  }else{
      return `The ${name} is associated with ${keys}`;
  }
}

function digitToWord(digit) {
  const numbers = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine'
  };

  if(numbers[digit]) {
    return numbers[digit];
  }else{
    return digit;
  }
}

function capitalizeText(string) {
  return string.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });    
}

function makeRequest(options, callback) {
  console.log(options);
  var request = http.request(options, 
  function(response) {
      var responseString = '';
      response.on('data', function(data) {
          responseString += data;
      });
       response.on('end', function() {
          var responseJSON = JSON.parse(responseString);
          callback(responseJSON, null);
      });
  });
  request.end();
}

exports.handler = function (event, context) {
  console.log('Loading Alexa handlers...');
  const alexa = Alexa.handler(event, context);
  // alexa.APP_ID = APP_ID;
  // To enable string internationalization (i18n) features, set a resources object.
  // alexa.resources = languageStrings;
  alexa.registerHandlers(handlers);
  alexa.execute();
};