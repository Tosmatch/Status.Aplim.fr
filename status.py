
import json, datetime, requests

services = [
    {"name" : "Slack", "url" : "https://status.slack.com/api/v2/status.json"},
     ]
status_list = []

for service in services:
    try:
        res = requests.get(service["url"], timeout=5)
        statuts= "ok" if res.status_code == 200 else "Down"
    except:
        statuts = "Down"

    status_list.append({"name": service["name"],"statuts" : statuts, "last_checked" : datetime.datetime.now().strftime("%d-%m-%Y-%H:%M") 
    })
    
with open("statut.json", "w") as f:
    json.dump(status_list, f, indent=2)
    
