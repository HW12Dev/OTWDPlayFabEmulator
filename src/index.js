const express = require('express');
const crypto = require('crypto');
const seedrandom = require('seedrandom');

function get_player_from_customid(customid) {
  return crypto.createHash("sha256").update(customid).digest("hex");
}

function get_weekly_rand_seed() {
  const now = new Date();
  const jan1st = new Date(now.getUTCFullYear(), 0, 1);
  const seed = now.getUTCFullYear().toString() + "-" + Math.ceil((now - jan1st) / 1000 / 60 / 60 / 24 / 7).toString();
  return seed;
}

function get_weekly_rand() {
  return seedrandom(get_weekly_rand_seed());
}

function rand_min_max(rng, min, max) {
  return Math.floor(rng() * (max - min + 1) + min);
}

const app = express();

app.use(express.json());

var weekly_quest_state = {}
var current_weekly_seed = "";

function get_player_weekly_quest_state(player) {
  if (!weekly_quest_state[player]) {
    return "Expired";
  }
  return weekly_quest_state[player];
}
function set_player_weekly_quest_state(player, state) {
  weekly_quest_state[player] = state;
}

function send_playfab_response(response_object, data_obj) {
  response_object.send({
    code: 200,
    status: "OK",
    data: data_obj
  })
}

function send_playfab_cloudscript_response(response_object, function_name, exists, cloudscript_result) {
  if(exists) {
    send_playfab_response(response_object,
      {
        FunctionName: function_name,
        Revision: 1,
        FunctionResult: cloudscript_result,
        // why does playfab give users this????
        Logs: [],
        ExecutionTimeSeconds: 0,
        ProcessorTimeSeconds: 0,
        MemoryConsumedBytes: 0,
        APIRequestsIssued: 0,
        HttpRequestsIssued: 0
      }
    );
  } else {
    send_playfab_response(response_object,
      {
        FunctionName: function_name,
        Revision: 1,
        Logs: [],
        ExecutionTimeSeconds: 0,
        ProcessorTimeSeconds: 0,
        MemoryConsumedBytes: 0,
        APIRequestsIssued: 0,
        HttpRequestsIssued: 0,
        Error: {
          Error: "CloudScriptNotFound",
          Message: "No function named " + function_name + " was found to execute",
          StackTrace: ""
        }
      }
    );
  }
}

function GetWeeklyQuest(res, player) {
  if(get_weekly_rand_seed() != current_weekly_seed) {
    current_weekly_seed = get_weekly_rand_seed();
    weekly_quest_state = {};
  }
  
  var rng = get_weekly_rand();

  var weeklyquestindex = rand_min_max(rng, 1, 14);
  var weeklyxp = rand_min_max(rng, 3, 5) * 1000;

  var weeklyscrap = rand_min_max(rng, 10, 20);
  var weeklyprov = rand_min_max(rng, 10, 20);
  var weeklyequip = rand_min_max(rng, 10, 20);
  var weeklymed = rand_min_max(rng, 10, 20);
  // if anyone knows what this is i'd love to know
  var weeklygold = 0;

  
  // /OTWD/Content/Schematics/Quests/QuestRootData.WeeklyMissionRewardList
  /*
  0, // high-end weapon pistol
  1, // high-end weapon revolver
  2, // high-end weapon ar
  3, // high-end weapon shotgun
  4, // high-end weapon smg
  5, // high-end weapon sniper
  6, // high-end weapon crossbow
  7, // high-end weapon mod case - barrel extension
  8, // high-end weapon mod case - sight
  9, // high-end weapon mod case - gadget
  10, // high-end weapon mod case - mod
  11, // legendary weapon ar
  12, // legendary weapon pistol
  13, // legendary weapon revolver
  14, // legendary weapon shotgun
  15, // legendary weapon smg
  16, // legendary weapon sniper
  17, // legendary weapon crossbow
  18, // legendary weapon mod case - barrel extension
  19, // legendary weapon mod case - gadget
  20, // legendary weapon mod case - mod
  21, // legendary weapon mod case - sight
  */
  var weaponrewards = [];

  var should_weekly_weapon_be_legendary = rand_min_max(rng, 1, 10) > 9;
  if(!should_weekly_weapon_be_legendary) {
    weaponrewards.push(rand_min_max(rng, 0, 6));
    weaponrewards.push(rand_min_max(rng, 7, 9));
    weaponrewards.push(rand_min_max(rng, 7, 9));
  } else {
    weaponrewards.push(rand_min_max(rng, 11, 17));
    weaponrewards.push(rand_min_max(rng, 18, 21));
    weaponrewards.push(rand_min_max(rng, 18, 21));
  }

  var quest_data = {
    timeLeft: 10000000,
    status: get_player_weekly_quest_state(player), // EOTWDPlayFabQuestProgression: "Inactive", "InProgress", "Completed", "Expired", "AwaitingUpdate"
    quest: {
      // 0 in script = /OTWD/Content/Schematics/Quests/QuestRootData.WeeklyQuests[0] = /OTWD/Content/Schematics/Quests/WeeklyMissions/Final/1
      WeeklyQuestIndex: weeklyquestindex, // Script is zero indexed, game is 1 indexed (in uassets)
      WeeklyXPReward: weeklyxp,
      "WeeklyScrap/Prov/Equip/Med/Gold": [
        weeklyscrap, // scrap
        weeklyprov, // provision
        weeklyequip, // equipment
        weeklymed, // medicine
        weeklygold // gold
      ],
      WeeklyWeaponRewardsIndices: weaponrewards,
    },
  };

  send_playfab_cloudscript_response(res, "GetWeeklyQuest", true, quest_data);
}

function GetSeed(res, player) {
  send_playfab_cloudscript_response(res, "GetSeed", true, {
    date: Date.now()
  });
}

function ActivateWeeklyQuest(res, player) {
  set_player_weekly_quest_state(player, "InProgress");
  send_playfab_cloudscript_response(res, "ActivateWeeklyQuest", true, {
    status: "InProgress",
  })
}

function GetBounties(res, player) {
  send_playfab_cloudscript_response(res, "GetBounties", true, "Expired");
}

app.post("/Client/LoginWithCustomID", (req, res) => {

  var sessionticket = "AAAAAAAA";
  if(req.body && req.body.CustomId) {
    sessionticket = get_player_from_customid(req.body.CustomId)
  }
  send_playfab_response(res, {
    SessionTicket: sessionticket,
    PlayFabId: "0000000000000000",
    NewlyCreated: false,
    SettingsForUser: {
      NeedsAttribution: false,
      GatherDeviceInfo: false,
      GatherFocusInfo: false
    },
    LastLoginTime: new Date().toISOString(),
    EntityToken: {
      EntityToken: "BBBBBBBB",
      TokenExpiration: new Date().toISOString(),
      Entity: {
        Id: "0000000000000000",
        Type: "title_player_account",
        TypeString: "title_player_account"
      }
    },
    TreatmentAssignment: {
      Variants: [],
      Variables: []
    }
  });
});

const wanderermaps = [
  "/Game/Schematics/Levels/MainQuests/Georgetown_Laundromat_03.Georgetown_Laundromat_03", // hell or high water
  "/Game/Schematics/Levels/MainQuests/Underpass_Assault_Bandits_01.Underpass_Assault_Bandits_01", // listening in
  "/Game/Schematics/Levels/MainQuests/DeptStore_Scavenge_Story_01.DeptStore_Scavenge_Story_01", // open season
  "/Game/Schematics/Levels/MainQuests/Underground_Escape_Story_01.Underground_Escape_Story_01", // last stop
  "/Game/Schematics/Levels/MainQuests/DeptStore_Assault_Military_01.DeptStore_Assault_Military_01", // doctor's orders
  "/Game/Schematics/Levels/MainQuests/Lincoln_Assault_Story_01.Lincoln_Assault_Story_01" // join or die
] // s2 missions might work but i wont add them for compatibility with old versions + its how it was left as on the playfab end

const wandererweapons = [
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/CZ805/DWP_CZ805.DWP_CZ805'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Pistols/1911/DWP_1911.DWP_1911'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/G36/DWP_G36.DWP_G36'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Revolvers/ColtDetective/DWP_ColtDetective.DWP_ColtDetective'"
]

const wandererattachments = [
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/AssaultLight/SCH_Attachment_Gadget_AssaultLight.SCH_Attachment_Gadget_AssaultLight'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/LEDCombo/SCH_Attachment_Gadget_LEDCombo.SCH_Attachment_Gadget_LEDCombo'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/AssaultLight/SCH_Attachment_Gadget_AssaultLight.SCH_Attachment_Gadget_AssaultLight'"
]
// this is probably the worst way to do it but i dont care xd
function GetWeeklyNPCItems(rng) {
  var itemslist = [];
  var weaponslist = wandererweapons;
  var attachmentslist = wandererattachments;

  for (index = 0; index <= 2; index++) {
    var selectedarray = index == 2 ? attachmentslist : weaponslist;
    var selectedindex = rand_min_max(rng, 0, selectedarray.length - 1);
    var selecteditem = selectedarray[selectedindex];
    var arrayitem = {Asset: selecteditem};
    itemslist.push(arrayitem);
    selectedarray.splice(selectedindex, 1);
  }
  return itemslist;
}


function GetWeeklyNPC(res, player) {
  var rng = get_weekly_rand();
  var selectedwanderermap = wanderermaps[rand_min_max(rng, 0, wanderermaps.length - 1)];
  var wanderer_data = {
        timeLeft: 10000000,
        status: "InProgress", // "InProgress", "Expired", "Completed"
        npc: {
            NPC: "OTWDAICharacterSchematic'/Game/Schematics/AICharacters/AISC_RescuableFollower_WANDERER1.AISC_RescuableFollower_WANDERER1'", // i doubt this needs to get changed
            Map: {
                Asset: `SBZLevelSchematic'${selectedwanderermap}'`,
            },
            Inventory: GetWeeklyNPCItems(rng)
        }
    };
    send_playfab_cloudscript_response(res, "GetWeeklyNPC", true, wanderer_data);
} // wanderer seems to be saved into the save game? not sure

function ActivateWeeklyNPC(res, player) {
  send_playfab_cloudscript_response(res, "ActivateWeeklyNPC", true, {
    status: "InProgress",
  })
}

app.post("/Client/ExecuteCloudScript", (req, res) => {
  if(!req.body["FunctionName"]) {
    res.status(400).send();
    return;
  }

  if(!req.headers["x-authorization"]) {
    res.status(401).send();
    return;
  }
  var player = req.headers["x-authorization"];
  
  var function_name = req.body["FunctionName"];

  if(function_name == "GetWeeklyQuest") {
    GetWeeklyQuest(res, player);
  } else if (function_name == "GetSeed") {
    GetSeed(res, player);
  } else if (function_name == "ActivateWeeklyQuest") {
    ActivateWeeklyQuest(res, player);
  } else if (function_name == "ActivateWeeklyNPC") {
    ActivateWeeklyNPC(res, player);
  } else if (function_name == "GetBounties") {
    GetBounties(res, player);
  } else if (function_name = "GetWeeklyNPC") {
    GetWeeklyNPC(res, player);
  } else {
    send_playfab_cloudscript_response(res, function_name, false, null);
  }
})

app.post("/Client/UpdateUserData", (req, res) => {
  if(!req.body["Data"] || !req.body["Data"]["WeeklyQuestDone"]) {
    res.status(400).send();
    return;
  }
  if(!req.headers["x-authorization"]) {
    res.status(401).send();
    return;
  }
  var player = req.headers["x-authorization"];

  if(req.body["Data"] && req.body["Data"]["WeeklyQuestDone"]) {
    // user has done weekly quest
    set_player_weekly_quest_state(player, "Completed");
  }

  send_playfab_response(res, {
    DataVersion: 1
  });
});

// custom
app.get("/ResetPlayerState", (req, res) => {
  if(!req.query.customid) {
    res.status(400).send("Bad request, missing ?customid=<br>Can be a steam id");
    return;
  }
  var customid = req.query.customid;
  weekly_quest_state[get_player_from_customid(customid)] = null;

  res.send("Reset player state for: " + customid);
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
})

app.post("/Client/GetUserReadOnlyData", (req, res) => {send_playfab_response(res, {Data: {}, DataVersion: 0})});
app.post("/Client/GetTitleData", (req, res) => {send_playfab_response(res, {Data: {}})});
app.post("/Client/WritePlayerEvent", (req, res) => {send_playfab_response(res, {EventId: ""})});
app.post("/Server/WritePlayerEvent", (req, res) => {send_playfab_response(res, {EventId: ""})});

app.get("/favicon.ico", (req, res) => {res.status(404).send();})
app.get("/", (req, res) => {
  res.send("AAAAA");
  return;
});

app.use((error, req, res, next) => {
  if(error instanceof SyntaxError) {
    return res.status(400).send();
  }

  next(error)
});

app.listen(3000, () => {});