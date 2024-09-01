let default_html = await fetch(browser.runtime.getURL("/resources/document.html"));
let default_css = await fetch(browser.runtime.getURL("/resources/document.css"));
let html = await default_html.text()
let css = await default_css.text();
console.log("started!")

browser.commands.onCommand.addListener(async (command)=>{
    console.log(command)
    if(command === "yoink-web"){
        let res = await browser.tabs.executeScript({
            code: "document.documentElement.innerHTML"
        });
        html = res[0];

    }
    else if(command === "yeet-web"){
        browser.tabs.executeScript({
            code: `document.documentElement.innerHTML = String.raw\`${html}\`;`
        })
        browser.tabs.insertCSS({
            code: `${css}`
        });
    }
})