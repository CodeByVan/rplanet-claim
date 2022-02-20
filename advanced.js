// This script works for multiple accounts to claim aether,
// increase claim limit, and send the remaining aether balance
// to a specified account.

// Change this unless you want to send all your aether to me
const MAIN_ACCOUNT = "vaaaaaaaaaan";

// Add as many claim accounts as you want (within reason)
const ACCOUNTS = [
  {
    username: "mywaxwallet1",
    pk: "privatekey1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    permission: "claim",
    cost: 1000,
  },
  {
    username: "mywaxwallet2",
    pk: "privatekey2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    permission: "claim",
    cost: 1000,
  },
];

const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const fetch = require("node-fetch");
const { TextDecoder, TextEncoder } = require("util");
const cron = require("node-cron");
const RPC = new JsonRpc("https://wax.eosusa.news/", { fetch });

const API = new Api({
  rpc: RPC,
  signatureProvider: new JsSignatureProvider(ACCOUNTS.map((x) => x.pk)),
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

console.log("Script started. Waiting for next claim...");
cron.schedule("10 * * * *", async () => {
  console.log("");
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    console.log("Account : ", account.username);

    const currentTime = Date.now();
    console.log("Current time : " + new Date(currentTime).toUTCString());

    // CLAIM AETHER
    try {
      await API.transact(
        {
          actions: [
            {
              account: "s.rplanet",
              name: "claim",
              authorization: [
                { actor: account.username, permission: account.permission },
              ],
              data: {
                to: account.username,
              },
            },
          ],
        },
        { blocksBehind: 0, expireSeconds: 60 }
      );
      console.log("Aether claimed successfully.");
    } catch (e) {
      console.log(e);
      console.log("ERROR CLAIMING AETHER!");
    }

    // INCREASE CLAIM LIMIT
    try {
      const r = await RPC.get_table_rows({
        json: true,
        code: "s.rplanet",
        scope: "s.rplanet",
        table: "claimlimits",
        lower_bound: account.username,
        limit: "1",
      });
      const lastExtendTime = parseInt(r.rows[0].extended_at) * 1000;
      const timeDiff = currentTime - lastExtendTime;

      if (timeDiff < 3300000) {
        console.log("LIMIT INCREASED WITHIN LAST HOUR!");
      } else {
        console.log(
          "Increasing claim limit, sending " +
            account.cost.toFixed(4) +
            " AETHER to s.rplanet..."
        );
        try {
          await API.transact(
            {
              actions: [
                {
                  account: "e.rplanet",
                  name: "transfer",
                  authorization: [
                    { actor: account.username, permission: account.permission },
                  ],
                  data: {
                    from: account.username,
                    to: "s.rplanet",
                    quantity: account.cost.toFixed(4) + " AETHER",
                    memo: "extend claim limit",
                  },
                },
              ],
            },
            { blocksBehind: 0, expireSeconds: 60 }
          );
          console.log("Claim limit extended successfully.");
        } catch (e) {
          console.log(e);
          console.log("ERROR EXTENDING CLAIM LIMIT!");
        }
      }
    } catch (e) {
      console.log(e);
      console.log("ERROR RETRIEVING CLAIM LIMIT DATA!");
    }

    // TRANSFER AETHER BALANCE
    try {
      // wait for balance to update
      await new Promise((r) => setTimeout(r, 3000));

      let r = await RPC.get_currency_balance(
        "e.rplanet",
        account.username,
        "AETHER"
      );
      const aetherBalance = r[0];

      console.log("Sending " + aetherBalance + " to " + MAIN_ACCOUNT + "...");
      try {
        await API.transact(
          {
            actions: [
              {
                account: "e.rplanet",
                name: "transfer",
                authorization: [
                  { actor: account.username, permission: account.permission },
                ],
                data: {
                  from: account.username,
                  to: MAIN_ACCOUNT,
                  quantity: aetherBalance,
                  memo: "",
                },
              },
            ],
          },
          { blocksBehind: 0, expireSeconds: 60 }
        );
        console.log("Aether sent successfully.");
      } catch (e) {
        console.log(e);
        console.log("ERROR TRANSFERRING AETHER TO MAIN ACCOUNT!");
      }
    } catch (e) {
      console.log(e);
      console.log("ERROR RETRIEVING AETHER BALANCE!");
    }

    console.log("...");
  }
});
