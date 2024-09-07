// content script to inject settings page
console.log("inject mode on!")

let injectPromise = (async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');
    urlParams.delete('code');

    if(code){
        browser.runtime.sendMessage({"type":"spotify", "command":"authorize", "code": code}).then(()=>{
            window.location.href = browser.runtime.getURL("/src/options/options.html");
        })
    }
})();