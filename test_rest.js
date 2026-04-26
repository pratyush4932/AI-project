import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

async function test() {
  const res = await fetch(`${url}/storage/v1/object/list/records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefix: "",
      limit: 100,
      offset: 0,
      sortBy: {
        column: "name",
        order: "asc"
      }
    })
  });
  const data = await res.json();
  console.log(data);
  
  if (data && data.length > 0) {
    const folder = data[0].name;
    console.log("Listing contents of " + folder);
    const res2 = await fetch(`${url}/storage/v1/object/list/records`, {
        method: 'POST',
        headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        prefix: folder,
        limit: 100,
        offset: 0,
        sortBy: {
            column: "name",
            order: "asc"
        }
        })
    });
    const data2 = await res2.json();
    console.log(data2);
  }
}

test();
