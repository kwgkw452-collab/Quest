(function () {
  "use strict";

  var questions = [
  {
    "id": "s005.communication.1",
    "category": "word",
    "prompt": "いいえ、予約していません。",
    "answers": [
      "No, we don’t.",
      "No.",
      "No, we don't.",
      "No, we do not.",
      "No reservation.",
      "We have no reservation."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "「いいえ」だから……ピコ。",
      "“No” を使って答えるピコ。",
      "No, we don’t."
    ],
    "communicative": {
      "conceptId": "hotel.reservation.none",
      "difficulty": "starter",
      "promptType": "answer",
      "expectedUtterance": "No, we don’t.",
      "poolId": "s005.communication.1.v1"
    }
  },
  {
    "id": "s005.communication.2",
    "category": "word",
    "prompt": "3人です。",
    "answers": [
      "Three.",
      "3.",
      "Three people.",
      "3 people.",
      "We are three."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "3人だから……ピコ。",
      "“Three” を使って答えるピコ。",
      "Three."
    ],
    "communicative": {
      "conceptId": "hotel.party.three",
      "difficulty": "starter",
      "promptType": "answer",
      "expectedUtterance": "Three.",
      "poolId": "s005.communication.2.v1"
    }
  },
  {
    "id": "s005.communication.3",
    "category": "word",
    "prompt": "キングサイズのベッドはありますか？",
    "answers": [
      "Do you have a king-size bed?",
      "Do you have king-size beds?",
      "Does this hotel have a king-size bed?",
      "Does this hotel have king-size beds?",
      "Does the hotel have a king-size bed?",
      "Is there a king-size bed?",
      "Are there any king-size beds?",
      "Do you have any king-size beds?",
      "Is a king-size bed available?",
      "King-size bed, please.",
      "A king-size bed, please.",
      "King-size beds, please."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“Do you...” から始めてみるピコ。",
      "“king-size bed” を使うピコ。",
      "Do you have a king-size bed?"
    ],
    "communicative": {
      "conceptId": "hotel.bed.king.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Do you have a king-size bed?",
      "poolId": "s005.communication.3.v1"
    }
  },
  {
    "id": "s005.communication.4",
    "category": "word",
    "prompt": "2部屋お願いします。",
    "answers": [
      "Two rooms, please.",
      "two rooms",
      "2 rooms",
      "two room",
      "2 room"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "2だから……ピコ。",
      "“Two” から始めるピコ。",
      "Two rooms, please."
    ],
    "communicative": {
      "conceptId": "hotel.rooms.two.request",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Two rooms, please.",
      "poolId": "s005.communication.4.v1"
    }
  },
  {
    "id": "s005.communication.5",
    "category": "word",
    "prompt": "はい、お願いします。",
    "answers": [
      "Yes, please.",
      "Yes.",
      "Please.",
      "Sure.",
      "OK.",
      "Okay."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "「はい」だから……ピコ。",
      "“Yes” を使って答えるピコ。",
      "Yes, please."
    ],
    "communicative": {
      "conceptId": "hotel.breakfast.yes",
      "difficulty": "starter",
      "promptType": "answer",
      "expectedUtterance": "Yes, please.",
      "poolId": "s005.communication.5.v1"
    }
  },
  {
    "id": "s005.communication.6",
    "category": "word",
    "prompt": "大丈夫ですか？",
    "answers": [
      "Are you OK?",
      "Are you okay?",
      "Are you all right?",
      "Are you alright?",
      "You OK?",
      "You okay?",
      "All right?",
      "Everything OK?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“Are you...” から始めるピコ。",
      "“OK” を使うピコ。",
      "Are you OK?"
    ],
    "communicative": {
      "conceptId": "s005.social.wellbeing.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Are you OK?",
      "poolId": "s005.communication.6.v1"
    }
  },
  {
    "id": "s005.communication.7",
    "category": "word",
    "prompt": "（あなたの）名前は何ですか？",
    "answers": [
      "What’s your name?",
      "What is your name?",
      "Your name, please?",
      "Name, please?",
      "May I have your name?",
      "Can I have your name?",
      "Could I have your name?",
      "May I know your name?",
      "Can I know your name?",
      "I want to know your name.",
      "I’d like to know your name.",
      "I would like to know your name.",
      "Tell me your name, please.",
      "Please tell me your name.",
      "What's your name?",
      "I'd like to know your name."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“What’s...” から始めてみるピコ。",
      "“your name” を使うピコ。",
      "What’s your name?"
    ],
    "communicative": {
      "conceptId": "social.name.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "What’s your name?",
      "poolId": "s005.communication.7.v1"
    }
  },
  {
    "id": "s005.communication.8",
    "category": "word",
    "prompt": "物を盗みましたか？",
    "answers": [
      "Do you steal things?",
      "Did you steal?",
      "Do you steal?",
      "Did you steal something?",
      "Did you steal anything?",
      "Do you steal something?",
      "Do you steal anything?",
      "Steal something?",
      "Steal anything?",
      "Stole something?",
      "Stole anything?",
      "Steal things?",
      "Stole things?",
      "Did you take something?",
      "Did you take anything?",
      "Did you take the bag?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“Did you...” または “Do you...” から始めるピコ。",
      "“steal” を使うピコ。",
      "Did you steal something?"
    ],
    "communicative": {
      "conceptId": "mystery.stealing.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Do you steal things?",
      "poolId": "s005.communication.8.v1"
    }
  },
  {
    "id": "s005.communication.9",
    "category": "word",
    "prompt": "私たちと一緒に来て。",
    "answers": [
      "Come with us.",
      "Come with me.",
      "Let’s go.",
      "Please come with us.",
      "Come with me, please.",
      "Let’s go together.",
      "Let's go.",
      "Let's go together."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“Come” または “Let’s” から始めるピコ。",
      "“with us” または “go” を使うピコ。",
      "Come with us.\nLet’s go."
    ],
    "communicative": {
      "conceptId": "social.come.with.us",
      "difficulty": "starter",
      "promptType": "invitation",
      "expectedUtterance": "Come with us.",
      "poolId": "s005.communication.9.v1"
    }
  },
  {
    "id": "s005.communication.10",
    "category": "word",
    "prompt": "バッグを見ましたか？",
    "answers": [
      "Did you see a bag?",
      "Do you see a bag?",
      "Have you seen a bag?",
      "Did you find a bag?",
      "Do you find a bag?",
      "Have you found a bag?",
      "See a bag?",
      "Find a bag?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“Did you...” から始めるピコ。",
      "“see” と “bag” を使うピコ。",
      "Did you see a bag?"
    ],
    "communicative": {
      "conceptId": "mystery.bag.sighting.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Did you see a bag?",
      "poolId": "s005.communication.10.v1"
    }
  },
  {
    "id": "s005.communication.11",
    "category": "word",
    "prompt": "彼の名前はBenです。",
    "answers": [
      "His name is Ben.",
      "His name’s Ben.",
      "He is Ben.",
      "He’s Ben.",
      "This is Ben.",
      "The monster is Ben.",
      "His name, Ben.",
      "His name's Ben.",
      "He's Ben."
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "“His...” から始めるピコ。",
      "“name” と “Ben” を使うピコ。",
      "His name is Ben."
    ],
    "communicative": {
      "conceptId": "social.ben.introduce",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "His name is Ben.",
      "poolId": "s005.communication.11.v1"
    }
  }
];
  var rules = [
  {
    "conceptId": "hotel.reservation.none",
    "variants": [
      "No, we don’t.",
      "No.",
      "No, we don't.",
      "No, we do not.",
      "No reservation.",
      "We have no reservation."
    ],
    "rejects": [
      {
        "variants": [
          "Yes, we do.",
          "We have a reservation."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "answer"
  },
  {
    "conceptId": "hotel.party.three",
    "variants": [
      "Three.",
      "3.",
      "Three people.",
      "3 people.",
      "We are three."
    ],
    "rejects": [
      {
        "variants": [
          "Two.",
          "Four."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "answer"
  },
  {
    "conceptId": "hotel.bed.king.ask",
    "variants": [
      "Do you have a king-size bed?",
      "Do you have king-size beds?",
      "Does this hotel have a king-size bed?",
      "Does this hotel have king-size beds?",
      "Does the hotel have a king-size bed?",
      "Is there a king-size bed?",
      "Are there any king-size beds?",
      "Do you have any king-size beds?",
      "Is a king-size bed available?",
      "King-size bed, please.",
      "A king-size bed, please.",
      "King-size beds, please."
    ],
    "rejects": [
      {
        "variants": [
          "We don't need a bed."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "question"
  },
  {
    "conceptId": "hotel.rooms.two.request",
    "variants": [
      "Two rooms, please.",
      "two rooms",
      "2 rooms",
      "two room",
      "2 room"
    ],
    "rejects": [
      {
        "variants": [
          "One room, please."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "request"
  },
  {
    "conceptId": "hotel.breakfast.yes",
    "variants": [
      "Yes, please.",
      "Yes.",
      "Please.",
      "Sure.",
      "OK.",
      "Okay."
    ],
    "rejects": [
      {
        "variants": [
          "No, thank you."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "answer"
  },
  {
    "conceptId": "s005.social.wellbeing.ask",
    "variants": [
      "Are you OK?",
      "Are you okay?",
      "Are you all right?",
      "Are you alright?",
      "You OK?",
      "You okay?",
      "All right?",
      "Everything OK?"
    ],
    "rejects": [
      {
        "variants": [
          "I don't care."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "question"
  },
  {
    "conceptId": "social.name.ask",
    "variants": [
      "What’s your name?",
      "What is your name?",
      "Your name, please?",
      "Name, please?",
      "May I have your name?",
      "Can I have your name?",
      "Could I have your name?",
      "May I know your name?",
      "Can I know your name?",
      "I want to know your name.",
      "I’d like to know your name.",
      "I would like to know your name.",
      "Tell me your name, please.",
      "Please tell me your name.",
      "What's your name?",
      "I'd like to know your name."
    ],
    "rejects": [
      {
        "variants": [
          "I don't want to know your name."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "question"
  },
  {
    "conceptId": "mystery.stealing.ask",
    "variants": [
      "Do you steal things?",
      "Did you steal?",
      "Do you steal?",
      "Did you steal something?",
      "Did you steal anything?",
      "Do you steal something?",
      "Do you steal anything?",
      "Steal something?",
      "Steal anything?",
      "Stole something?",
      "Stole anything?",
      "Steal things?",
      "Stole things?",
      "Did you take something?",
      "Did you take anything?",
      "Did you take the bag?"
    ],
    "rejects": [
      {
        "variants": [
          "You are a thief."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "question"
  },
  {
    "conceptId": "social.come.with.us",
    "variants": [
      "Come with us.",
      "Come with me.",
      "Let’s go.",
      "Please come with us.",
      "Come with me, please.",
      "Let’s go together.",
      "Let's go.",
      "Let's go together."
    ],
    "rejects": [
      {
        "variants": [
          "Go away."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "invitation"
  },
  {
    "conceptId": "mystery.bag.sighting.ask",
    "variants": [
      "Did you see a bag?",
      "Do you see a bag?",
      "Have you seen a bag?",
      "Did you find a bag?",
      "Do you find a bag?",
      "Have you found a bag?",
      "See a bag?",
      "Find a bag?"
    ],
    "rejects": [
      {
        "variants": [
          "I don't care about the bag."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "question"
  },
  {
    "conceptId": "social.ben.introduce",
    "variants": [
      "His name is Ben.",
      "His name’s Ben.",
      "He is Ben.",
      "He’s Ben.",
      "This is Ben.",
      "The monster is Ben.",
      "His name, Ben.",
      "His name's Ben.",
      "He's Ben."
    ],
    "rejects": [
      {
        "variants": [
          "He is a ghost."
        ],
        "reason": "contrary-goal"
      }
    ],
    "difficulty": "starter",
    "promptType": "statement"
  }
];

  var pools = [
  {
    "poolId": "s005.communication.1.v1",
    "items": [
      {
        "itemId": "s005.communication.1",
        "conceptId": "hotel.reservation.none",
        "displayValue": "いいえ、予約していません。",
        "prompts": [
          {
            "promptType": "answer",
            "difficulty": "starter",
            "expectedUtterance": "No, we don’t.",
            "acceptedVariants": [
              "No, we don’t.",
              "No.",
              "No, we don't.",
              "No, we do not.",
              "No reservation.",
              "We have no reservation."
            ]
          },
          {
            "promptType": "answer",
            "difficulty": "starter",
            "expectedUtterance": "No.",
            "acceptedVariants": [
              "No, we don’t.",
              "No.",
              "No, we don't.",
              "No, we do not.",
              "No reservation.",
              "We have no reservation."
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.2.v1",
    "items": [
      {
        "itemId": "s005.communication.2",
        "conceptId": "hotel.party.three",
        "displayValue": "3人です。",
        "prompts": [
          {
            "promptType": "answer",
            "difficulty": "starter",
            "expectedUtterance": "Three.",
            "acceptedVariants": [
              "Three.",
              "3.",
              "Three people.",
              "3 people.",
              "We are three."
            ]
          },
          {
            "promptType": "answer",
            "difficulty": "starter",
            "expectedUtterance": "3.",
            "acceptedVariants": [
              "Three.",
              "3.",
              "Three people.",
              "3 people.",
              "We are three."
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.3.v1",
    "items": [
      {
        "itemId": "s005.communication.3",
        "conceptId": "hotel.bed.king.ask",
        "displayValue": "キングサイズのベッドはありますか？",
        "prompts": [
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Do you have a king-size bed?",
            "acceptedVariants": [
              "Do you have a king-size bed?",
              "Do you have king-size beds?",
              "Does this hotel have a king-size bed?",
              "Does this hotel have king-size beds?",
              "Does the hotel have a king-size bed?",
              "Is there a king-size bed?",
              "Are there any king-size beds?",
              "Do you have any king-size beds?",
              "Is a king-size bed available?",
              "King-size bed, please.",
              "A king-size bed, please.",
              "King-size beds, please."
            ]
          },
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "King-size bed, please.",
            "acceptedVariants": [
              "Do you have a king-size bed?",
              "Do you have king-size beds?",
              "Does this hotel have a king-size bed?",
              "Does this hotel have king-size beds?",
              "Does the hotel have a king-size bed?",
              "Is there a king-size bed?",
              "Are there any king-size beds?",
              "Do you have any king-size beds?",
              "Is a king-size bed available?",
              "King-size bed, please.",
              "A king-size bed, please.",
              "King-size beds, please."
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.4.v1",
    "items": [
      {
        "itemId": "s005.communication.4",
        "conceptId": "hotel.rooms.two.request",
        "displayValue": "2部屋お願いします。",
        "prompts": [
          {
            "promptType": "request",
            "difficulty": "starter",
            "expectedUtterance": "Two rooms, please.",
            "acceptedVariants": [
              "Two rooms, please.",
              "two rooms",
              "2 rooms",
              "two room",
              "2 room"
            ]
          },
          {
            "promptType": "request",
            "difficulty": "starter",
            "expectedUtterance": "2 rooms",
            "acceptedVariants": [
              "Two rooms, please.",
              "two rooms",
              "2 rooms",
              "two room",
              "2 room"
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.5.v1",
    "items": [
      {
        "itemId": "s005.communication.5",
        "conceptId": "hotel.breakfast.yes",
        "displayValue": "はい、お願いします。",
        "prompts": [
          {
            "promptType": "answer",
            "difficulty": "starter",
            "expectedUtterance": "Yes, please.",
            "acceptedVariants": [
              "Yes, please.",
              "Yes.",
              "Please.",
              "Sure.",
              "OK.",
              "Okay."
            ]
          },
          {
            "promptType": "answer",
            "difficulty": "starter",
            "expectedUtterance": "Sure.",
            "acceptedVariants": [
              "Yes, please.",
              "Yes.",
              "Please.",
              "Sure.",
              "OK.",
              "Okay."
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.6.v1",
    "items": [
      {
        "itemId": "s005.communication.6",
        "conceptId": "s005.social.wellbeing.ask",
        "displayValue": "大丈夫ですか？",
        "prompts": [
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Are you OK?",
            "acceptedVariants": [
              "Are you OK?",
              "Are you okay?",
              "Are you all right?",
              "Are you alright?",
              "You OK?",
              "You okay?",
              "All right?",
              "Everything OK?"
            ]
          },
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Are you all right?",
            "acceptedVariants": [
              "Are you OK?",
              "Are you okay?",
              "Are you all right?",
              "Are you alright?",
              "You OK?",
              "You okay?",
              "All right?",
              "Everything OK?"
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.7.v1",
    "items": [
      {
        "itemId": "s005.communication.7",
        "conceptId": "social.name.ask",
        "displayValue": "（あなたの）名前は何ですか？",
        "prompts": [
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "What’s your name?",
            "acceptedVariants": [
              "What’s your name?",
              "What is your name?",
              "Your name, please?",
              "Name, please?",
              "May I have your name?",
              "Can I have your name?",
              "Could I have your name?",
              "May I know your name?",
              "Can I know your name?",
              "I want to know your name.",
              "I’d like to know your name.",
              "I would like to know your name.",
              "Tell me your name, please.",
              "Please tell me your name.",
              "What's your name?",
              "I'd like to know your name."
            ]
          },
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Name, please?",
            "acceptedVariants": [
              "What’s your name?",
              "What is your name?",
              "Your name, please?",
              "Name, please?",
              "May I have your name?",
              "Can I have your name?",
              "Could I have your name?",
              "May I know your name?",
              "Can I know your name?",
              "I want to know your name.",
              "I’d like to know your name.",
              "I would like to know your name.",
              "Tell me your name, please.",
              "Please tell me your name.",
              "What's your name?",
              "I'd like to know your name."
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.8.v1",
    "items": [
      {
        "itemId": "s005.communication.8",
        "conceptId": "mystery.stealing.ask",
        "displayValue": "物を盗みましたか？",
        "prompts": [
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Do you steal things?",
            "acceptedVariants": [
              "Do you steal things?",
              "Did you steal?",
              "Do you steal?",
              "Did you steal something?",
              "Did you steal anything?",
              "Do you steal something?",
              "Do you steal anything?",
              "Steal something?",
              "Steal anything?",
              "Stole something?",
              "Stole anything?",
              "Steal things?",
              "Stole things?",
              "Did you take something?",
              "Did you take anything?",
              "Did you take the bag?"
            ]
          },
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Did you steal?",
            "acceptedVariants": [
              "Do you steal things?",
              "Did you steal?",
              "Do you steal?",
              "Did you steal something?",
              "Did you steal anything?",
              "Do you steal something?",
              "Do you steal anything?",
              "Steal something?",
              "Steal anything?",
              "Stole something?",
              "Stole anything?",
              "Steal things?",
              "Stole things?",
              "Did you take something?",
              "Did you take anything?",
              "Did you take the bag?"
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.9.v1",
    "items": [
      {
        "itemId": "s005.communication.9",
        "conceptId": "social.come.with.us",
        "displayValue": "私たちと一緒に来て。",
        "prompts": [
          {
            "promptType": "invitation",
            "difficulty": "starter",
            "expectedUtterance": "Come with us.",
            "acceptedVariants": [
              "Come with us.",
              "Come with me.",
              "Let’s go.",
              "Please come with us.",
              "Come with me, please.",
              "Let’s go together.",
              "Let's go.",
              "Let's go together."
            ]
          },
          {
            "promptType": "invitation",
            "difficulty": "starter",
            "expectedUtterance": "Let’s go.",
            "acceptedVariants": [
              "Come with us.",
              "Come with me.",
              "Let’s go.",
              "Please come with us.",
              "Come with me, please.",
              "Let’s go together.",
              "Let's go.",
              "Let's go together."
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.10.v1",
    "items": [
      {
        "itemId": "s005.communication.10",
        "conceptId": "mystery.bag.sighting.ask",
        "displayValue": "バッグを見ましたか？",
        "prompts": [
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Did you see a bag?",
            "acceptedVariants": [
              "Did you see a bag?",
              "Do you see a bag?",
              "Have you seen a bag?",
              "Did you find a bag?",
              "Do you find a bag?",
              "Have you found a bag?",
              "See a bag?",
              "Find a bag?"
            ]
          },
          {
            "promptType": "question",
            "difficulty": "starter",
            "expectedUtterance": "Did you find a bag?",
            "acceptedVariants": [
              "Did you see a bag?",
              "Do you see a bag?",
              "Have you seen a bag?",
              "Did you find a bag?",
              "Do you find a bag?",
              "Have you found a bag?",
              "See a bag?",
              "Find a bag?"
            ]
          }
        ]
      }
    ]
  },
  {
    "poolId": "s005.communication.11.v1",
    "items": [
      {
        "itemId": "s005.communication.11",
        "conceptId": "social.ben.introduce",
        "displayValue": "彼の名前はBenです。",
        "prompts": [
          {
            "promptType": "statement",
            "difficulty": "starter",
            "expectedUtterance": "His name is Ben.",
            "acceptedVariants": [
              "His name is Ben.",
              "His name’s Ben.",
              "He is Ben.",
              "He’s Ben.",
              "This is Ben.",
              "The monster is Ben.",
              "His name, Ben.",
              "His name's Ben.",
              "He's Ben."
            ]
          },
          {
            "promptType": "statement",
            "difficulty": "starter",
            "expectedUtterance": "This is Ben.",
            "acceptedVariants": [
              "His name is Ben.",
              "His name’s Ben.",
              "He is Ben.",
              "He’s Ben.",
              "This is Ben.",
              "The monster is Ben.",
              "His name, Ben.",
              "His name's Ben.",
              "He's Ben."
            ]
          }
        ]
      }
    ]
  }
];

  questions.forEach(function (definition) { QuestionDatabase.register(definition); });
  Array.prototype.push.apply(CommunicativeJudgeRuleData, rules);
  Array.prototype.push.apply(LotteryPoolData, pools);
  LotteryEngine.init(LotteryPoolData);
})();
