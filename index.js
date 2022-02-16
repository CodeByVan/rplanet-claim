const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const fetch = require("node-fetch");
const { TextDecoder, TextEncoder } = require("util");
const cron = require("node-cron");

// YOUR WAX WALLET GOES HERE
const USERNAME = "mywaxwallet1";

// YOUR PERMISSION NAME GOES HERE
// It is strongly suggested to create a custom "claim" permission for this purpose
// https://waxsweden.org/course/adding-custom-permission-using-bloks/
// add permissions for the following 2 actions
// Contract Name: e.rplanet
// Contract Action: transfer
// Contract Name: s.rplanet
// Contract Action: claim
const PERMISSION = "claim";

// YOUR PRIVATE KEY GOES HERE (DO NOT SHARE WITH ANYONE)
const PRIVATE_KEY = ["xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"];

// YOUR CLAIM EXTENSION COST GOES HERE
// To figure this out, set your claim limit to whatever you want it to be,
// then when it drops 1% after an hour, see how much it would cost to increase
// it back to the original value
const CLAIM_LIMIT_AETHER_COST = 1041.0203; // 100000 limit

const SIG_PROVIDER = new JsSignatureProvider(PRIVATE_KEY);
// see here for other endpoints
// https://wax.eosio.online/endpoints
const RPC = new JsonRpc("https://wax.eosusa.news/", { fetch });
const API = new Api({
  rpc: RPC,
  signatureProvider: SIG_PROVIDER,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

// This runs at 30 minutes after the hour, every hour.
// In the first half of an hour, make sure all your aether is claimed
// and your claim limit is set to the amount you want, then start the script.
cron.schedule("30 * * * *", async () => {
  try {
    const r = await RPC.get_table_rows({
      json: true,
      code: "s.rplanet",
      scope: "s.rplanet",
      table: "claimlimits",
      lower_bound: USERNAME,
      limit: "1",
    });
    const currentTime = Date.now();
    const lastExtendTime = parseInt(r.rows[0].extended_at) * 1000;
    const timeDiff = currentTime - lastExtendTime;
    console.log("Current time : " + currentTime);
    console.log("Last extend  : " + lastExtendTime);
    console.log("Difference   : " + timeDiff);

    if (timeDiff < 3540000) {
      console.log("Recently increased claim limit, waiting until next hour.");
    } else {
      console.log(
        "Increasing claim limit, sending " +
          CLAIM_LIMIT_AETHER_COST.toFixed(4) +
          " AETHER to s.rplanet"
      );
      try {
        await API.transact(
          {
            actions: [
              {
                account: "e.rplanet",
                name: "transfer",
                authorization: [{ actor: USERNAME, permission: PERMISSION }],
                data: {
                  from: USERNAME,
                  to: "s.rplanet",
                  quantity: CLAIM_LIMIT_AETHER_COST.toFixed(4) + " AETHER",
                  memo: "extend claim limit",
                },
              },
            ],
          },
          { blocksBehind: 0, expireSeconds: 60 }
        );
        console.log("Limit extended successfully, attempting to claim aether.");
        await API.transact(
          {
            actions: [
              {
                account: "s.rplanet",
                name: "claim",
                authorization: [{ actor: USERNAME, permission: PERMISSION }],
                data: {
                  to: USERNAME,
                },
              },
            ],
          },
          { blocksBehind: 0, expireSeconds: 60 }
        );
        console.log("Aether claimed successfully, see you next hour.");
      } catch (e) {
        console.log(e);
      }
    }
  } catch (e) {
    console.log(e);
  }
});
