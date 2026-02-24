import urllib.request, json, time
url = 'https://script.google.com/macros/s/AKfycbwo1oxc9f05M5_rpwxnW-ZjYHrTJCjWNifvpoxIy8nzOgj-Y63i-pk9As0l2AT2fwipYA/exec?action=getInventory&username=admin&_=' + str(int(time.time()))

req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print(json.dumps(data[-1] if len(data) > 0 else {}, indent=2))
