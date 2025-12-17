import { hc } from "hono/client";
import type { AppType } from "./index";

const client = hc<AppType>("http://localhost:8787");

async function main() {
  console.log("📡 Locating you...");
  const me = await client.index.$get();
  const myData = await me.json();
  console.log(`📍 You are at: ${myData.formatted_address}\n`);

  // Function to print stores nicely
  const printStores = async (name: string, apiCall: any) => {
    console.log(`🔍 Scanning 5km radius for ${name}...`);
    const res = await apiCall.$get();
    const data = await res.json();

    if (data.found) {
      console.log(`✅ Found ${data.count} stores! Here are the closest ones:`);

      // Loop through the results (showing max 5 for brevity)
      data.stores.slice(0, 5).forEach((store: any, index: number) => {
        console.log(
          `   ${index + 1}. [${store.distance_km}km] ${store.name}, ${
            store.address
          }`
        );
      });

      if (data.count > 5) console.log(`   ...and ${data.count - 5} more.`);
    } else {
      console.log(`❌ No stores found.`);
    }
    console.log("------------------------------------------------");
  };

  await printStores("Circle K", client.stores["circle-k"]);
  await printStores("Family Mart", client.stores["family-mart"]);
  await printStores("Other stores", client.stores["others"]);
}

main();
