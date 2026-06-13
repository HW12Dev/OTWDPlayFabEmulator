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
]

const wandererweapons = [
  // assault rifle
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/CZ805/DWP_CZ805.DWP_CZ805'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/AKM/DWP_AKM.DWP_AKM'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/G36/DWP_G36.DWP_G36'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/M4A1/DWP_M4A1.DWP_M4A1'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/AssaultRifles/SCAR/DWP_SCAR.DWP_SCAR'",
  // crossbow
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Crossbows/Barnett/DWP_Barnett.DWP_Barnett'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Crossbows/Hercules/DWP_Hercules.DWP_Hercules'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Crossbows/Rogue/DWP_Rogue.DWP_Rogue'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Crossbows/Solid/DWP_Solid.DWP_Solid'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Crossbows/TurboGT/DWP_TurboGT.DWP_TurboGT'",
  
  // melee
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/BaseballBat/DWP_BaseballBat.DWP_BaseballBat'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/BaseballBat/Bat_Common/DWP_BaseballBat_Common.DWP_BaseballBat_Common'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/BaseballBat/Bat_Epic/DWP_BaseballBat_Epic.DWP_BaseballBat_Epic'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/FireAxe/DWP_Fireaxe2.DWP_Fireaxe2'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/FireAxe/Axe_Common/DWP_Fireaxe_Common.DWP_Fireaxe_Common'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/FireAxe/Final_Fireaxe/DWP_Fireaxe.DWP_Fireaxe'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Machete/DWP_Machete.DWP_Machete'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Machete/Machete_3/DWP_Machete3.DWP_Machete3'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Machete/Machete_Common/DWP_Machete_Common.DWP_Machete_Common'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Pickaxe/DWP_Pickaxe.DWP_Pickaxe'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Pickaxe/Epic_Rarity/DWP_Pickaxe_Epic.DWP_Pickaxe_Epic'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Pickaxe/Pickaxe_Rare/DWP_Pickaxe_Rare.DWP_Pickaxe_Rare'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Quarterstaff/DWP_Staff.DWP_Staff'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Quarterstaff/Staff_Epic/DWP_Staff_Epic.DWP_Staff_Epic'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Melee/Quarterstaff/Staff_Rare/DWP_Staff_Rare.DWP_Staff_Rare'",
  // pistol
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Pistols/1911/DWP_1911.DWP_1911'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Pistols/DesertEagle/DWP_DesertEagle.DWP_DesertEagle'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Pistols/Glock17/DWP_Glock17.DWP_Glock17'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Pistols/M92FS/DWP_M92FS.DWP_M92FS'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Pistols/P226/DWP_P226.DWP_P226'",
  // revolver
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Revolvers/ColtDetective/DWP_ColtDetective.DWP_ColtDetective'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Revolvers/ColtPython/DWP_ColtPython.DWP_ColtPython'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Revolvers/R8/DWP_R8.DWP_R8'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Revolvers/RagingBull/DWP_RagingBull.DWP_RagingBull'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Revolvers/SW29/DWP_SW29.DWP_SW29'",
  // shotgun
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Shotguns/Andersson/DWP_Anderson.DWP_Anderson'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Shotguns/M37/DWP_M37.DWP_M37'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Shotguns/R870/DWP_R870.DWP_R870'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Shotguns/Redhead/DWP_Redhead.DWP_Redhead'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Shotguns/SPAS12/DWP_SPAS12.DWP_SPAS12'",
  // smg
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Smgs/K23/DWP_K23.DWP_K23'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Smgs/Mac10/DWP_Mac10.DWP_Mac10'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Smgs/MP5/DWP_MP5.DWP_MP5'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Smgs/Scorpion/DWP_Scorpion.DWP_Scorpion'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Smgs/Tec9/DWP_Tec9.DWP_Tec9'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Smgs/UMP45/DWP_UMP45.DWP_UMP45'",
  // sniper
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Snipers/AWM/DWP_AWM.DWP_AWM'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Snipers/M14/DWP_M14.DWP_M14'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Snipers/Model70/DWP_Model70.DWP_Model70'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Snipers/Mosin/DWP_Mosin.DWP_Mosin'",
  "SBZWeaponData'/Game/Schematics/Weapons/PlayerWeapons/Snipers/SVD/DWP_SVD.DWP_SVD'"
]

const wandererattachments = [
  // barrel extensions
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/Competitors/SCH_BarrelExt_Compensator_Competitors.SCH_BarrelExt_Compensator_Competitors'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/EWK/SCH_BarrelExt_Compensator_EWK.SCH_BarrelExt_Compensator_EWK'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/Facepunch/SCH_BarrelExt_Compensator_Facepunch.SCH_BarrelExt_Compensator_Facepunch'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/FunnelOfFun/SCH_BarrelExt_Compensator_FunnelOfFun.SCH_BarrelExt_Compensator_FunnelOfFun'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/IPSC/SCH_BarrelExt_Compensator_IPSC.SCH_BarrelExt_Compensator_IPSC'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/KingsCrown/SCH_BarrelExt_Compensator_KingsCrown.SCH_BarrelExt_Compensator_KingsCrown'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/SharkTeeth/SCH_BarrelExt_Compensator_SharkTeeth.SCH_BarrelExt_Compensator_SharkTeeth'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Compensators/Tactical/SCH_BarrelExt_Compensator_Tactical.SCH_BarrelExt_Compensator_Tactical'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/FlashHiders/PistolFlashHider/SCH_BarrelExt_FlashHider_Pistol.SCH_BarrelExt_FlashHider_Pistol'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/Aurora/SCH_BarrelExtension_Suppressor_Aurora.SCH_BarrelExtension_Suppressor_Aurora'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/Hush/SCH_BarrelExtension_Suppressor_Hush.SCH_BarrelExtension_Suppressor_Hush'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/LowProfile/SCH_BarrelExtension_Suppressor_LowProfile.SCH_BarrelExtension_Suppressor_LowProfile'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/Monolith/SCH_BarrelExtension_Suppressor_Monolith.SCH_BarrelExtension_Suppressor_Monolith'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/Sandman/SCH_BarrelExtension_Suppressor_Sandman.SCH_BarrelExtension_Suppressor_Sandman'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/ShhSuppressor/SCH_BarrelExtension_Suppressor_Shh.SCH_BarrelExtension_Suppressor_Shh'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/SilentKiller/SCH_BarrelExtension_Suppressor_SilentKiller.SCH_BarrelExtension_Suppressor_SilentKiller'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/StandardIssue/SCH_BarrelExtension_Suppressor_StandardIssue.SCH_BarrelExtension_Suppressor_StandardIssue'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/TheBiggerTheBetter/SCH_BarrelExtension_Suppressor_TheBiggerTheBetter.SCH_BarrelExtension_Suppressor_TheBiggerTheBetter'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/BarrelExtensions/Suppressors/Turbo/SCH_BarrelExtension_Suppressor_Turbo.SCH_BarrelExtension_Suppressor_Turbo'",
  // crossbow
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/CrossbowReceiver/Crossbow_CrossbowReceiver_Balanced.Crossbow_CrossbowReceiver_Balanced'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/CrossbowReceiver/Crossbow_CrossbowReceiver_Precision.Crossbow_CrossbowReceiver_Precision'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/CrossbowReceiver/Crossbow_CrossbowReceiver_Skeletal.Crossbow_CrossbowReceiver_Skeletal'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/Riser/Crossbow_Riser_Skeletal.Crossbow_Riser_Skeletal'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/Riser/Crossbow_Riser_Solid.Crossbow_Riser_Solid'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/Riser/Crossbow_Riser_Weighted.Crossbow_Riser_Weighted'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/WheelCam/Balanced/Crossbow_WheelCam_Balanced.Crossbow_WheelCam_Balanced'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/WheelCam/Skeletal/Crossbow_WheelCam_Skeletal.Crossbow_WheelCam_Skeletal'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Crossbow/WheelCam/Solid/Crossbow_WheelCam_Solid.Crossbow_WheelCam_Solid'",

  // gadgets
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/AssaultLight/SCH_Attachment_Gadget_AssaultLight.SCH_Attachment_Gadget_AssaultLight'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/CompactLaserModule/SCH_Attachment_Gadget_CompactLaserModule.SCH_Attachment_Gadget_CompactLaserModule'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/FoxtrotLight/SCH_Attachment_Gadget_FoxtrotLight.SCH_Attachment_Gadget_FoxtrotLight'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/InforceLight/SCH_Attachment_Gadget_InforceLight.SCH_Attachment_Gadget_InforceLight'",
  //"SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/LEDCombo/SCH_Attachment_Gadget_LEDCombo.SCH_Attachment_Gadget_LEDCombo'", // not used ingame at all!!
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/Pec15/SCH_Attachment_Gadget_Pec15.SCH_Attachment_Gadget_Pec15'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/PocketLaser/SCH_Attachment_Gadget_PocketLaser.SCH_Attachment_Gadget_PocketLaser'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/StingrayLaser/SCH_Attachment_Gadget_StingrayLaser.SCH_Attachment_Gadget_StingrayLaser'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Gadgets/TacticalPistolLight/SCH_Attachment_Gadget_TacticalPistolLight.SCH_Attachment_Gadget_TacticalPistolLight'",
  // mag
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Mags/Pmag/SCH_Attachment_Mag_Pmag.SCH_Attachment_Mag_Pmag'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Mags/Speedpull/SCH_Attachment_Mag_Speedpull.SCH_Attachment_Mag_Speedpull'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Mags/Troy/SCH_Attachment_Mag_Troy.SCH_Attachment_Mag_Troy'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Mags/Vintage/SCH_Attachment_Mag_Vintage.SCH_Attachment_Mag_Vintage'",
  // sights
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/Acog/SCH_Sight_Acog.SCH_Sight_Acog'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/CrossbowScope/SCH_Sight_CrossbowScope.SCH_Sight_CrossbowScope'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/Holographic/SCH_Sight_Holographic.SCH_Sight_Holographic'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/Milspec/SCH_Sight_Milspec.SCH_Sight_Milspec'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/PistolDeltaSight/SCH_Sight_PistolDeltaSight.SCH_Sight_PistolDeltaSight'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/PistolRedDot/SCH_Sight_PistolRedDot.SCH_Sight_PistolRedDot'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/PrecisionScope/SCH_Sight_PrecisionScope.SCH_Sight_PrecisionScope'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/RifleLong10X/SCH_Sight_RifleLong10X.SCH_Sight_RifleLong10X'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/RifleLong6X/SCH_Sight_RifleLong6X.SCH_Sight_RifleLong6X'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/Solar/SCH_Sight_Solar.SCH_Sight_Solar'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/Speculator/SCH_Sight_Speculator.SCH_Sight_Speculator'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Sights/Vintage/SCH_Sight_Vintage.SCH_Sight_Vintage'",
  // stocks
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Stocks/FixedStock/SCH_Attachment_Stock_Fixed.SCH_Attachment_Stock_Fixed'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Stocks/FoldingStock/SCH_Attachment_Stock_Folding.SCH_Attachment_Stock_Folding'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Stocks/Tactical/SCH_Attachment_Stock_Tactical.SCH_Attachment_Stock_Tactical'",
  "SBZWeaponPartSchematic'/Game/Schematics/WeaponParts/Attachments/Stocks/TwoPieceStock/SCH_Attachment_Stock_TwoPiece.SCH_Attachment_Stock_TwoPiece'",
]
// this is probably the worst way to do it but i dont care xd
function GetWeeklyNPCItems(rng) {
  var itemslist = [];
  var weaponslist = wandererweapons.slice();
  var attachmentslist = wandererattachments.slice();

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