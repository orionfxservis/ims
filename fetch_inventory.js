const url = 'https://script.google.com/macros/s/AKfycbwo1oxc9f05M5_rpwxnW-ZjYHrTJCjWNifvpoxIy8nzOgj-Y63i-pk9As0l2AT2fwipYA/exec?action=getInventory&username=admin&_=' + new Date().getTime();
fetch(url).then(r => r.json()).then(data => {
    console.log(JSON.stringify(data[data.length - 1], null, 2));
}).catch(console.error);
