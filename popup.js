
const defaultCat = "general"  // Default category.

let dataDict = {};

function doInCurrentTab(tabCallback) {
    // Get the current tab id.

    chrome.tabs.query(
        { currentWindow: true, active: true },
        function (tabArray) { tabCallback(tabArray[0]) }
    )
}

function inject(text) {
    // Function that injects text into detected inputs.

    var txt = document.querySelectorAll("input, textarea, p")
    for (var i=0;i<txt.length;i++) {
        if (txt[i].type !== 'file') {
            txt[i].textContent = txt[i].textContent + text
        }
    }
}

function createMacroElement(macroText) {
    // Create the button element of a macro.

    var activeTabId
    doInCurrentTab(function(tab) {
        activeTabId = tab.id
    })
    var custoMacro = document.createElement('button')
    custoMacro.textContent = macroText
    custoMacro.innerText = macroText.slice(0, 65)
    custoMacro.title = macroText
    custoMacro.id = "macro"
    custoMacro.addEventListener('click', function() {
        // Execute the inject(text) function when the macro is clicked.
        chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            func: inject,
            args: [macroText]
        })
    })
    // Add the button to the "macroContainer" div.
    var macroContainer = document.getElementById('macroContainer')
    macroContainer.appendChild(custoMacro)
}

function changeCat(catName) {
    // Change current category.

    // When clicked, delete all #cat and #macro buttons.
    var elementsCat = document.querySelectorAll('#cat')
    var elementsMacro = document.querySelectorAll('#macro')
    elementsCat.forEach(function(element) {
        element.parentNode.removeChild(element)
    })
    elementsMacro.forEach(function(element) {
        element.parentNode.removeChild(element)
    })
    window.value = catName  // Change current category.
    chrome.storage.local.set({'actualCat': window.value})  // Save category.
    loadElements()  // Recreate categories and macros.
}

function createCatElement(catName) {
    // Creation of a category button element.

    var activeTabId
    doInCurrentTab(function (tab) {
        activeTabId = tab.id
    })
    var newCat = document.createElement('button')
    newCat.textContent = catName
    newCat.innerText = catName.slice(0, 65)
    newCat.title = catName
    newCat.id = "cat"
    // Execute the changeCat(catName) function when the button is clicked.
    newCat.addEventListener('click', function() {changeCat(catName)})
    // Add the button to the "macroContainer" div.
    var macroContainer = document.getElementById('macroContainer')
    macroContainer.appendChild(newCat)
}

function loadElements() {
    // Function that loads and displays elements from the localstorage.

    // Load current category.
    chrome.storage.local.get(['actualCat'], function(result) {
        if (result.actualCat == undefined) {  // The category has not been saved.
            // Load the default category and save it in the localstorage.
            chrome.storage.local.set({'actualCat': defaultCat})
            window.value = defaultCat
        } else {
            window.value = result.actualCat
        }
        // Refresh current category display.
        if (window.value == defaultCat) {
            document.getElementById("catStatus").textContent = ""
        } else {
            document.getElementById("catStatus").textContent = window.value.slice(0, 12)
        }
        // Load categories and macros from localstorage.
        chrome.storage.local.get(['macroDict'], function(result) {
            var macroDict = JSON.parse(result.macroDict)
            // Browse macro dictionary categories.
            for (var cle of Object.keys(macroDict)) {
                // Display categories only in the default category.
                if (window.value == defaultCat && cle !== defaultCat) {
                    (function(cle) {  // Create the category button.
                        createCatElement(cle)
                    })(cle)
                }
                if (cle == window.value) {
                    // Browse macros in the current category.
                    for (var i = 0; i < macroDict[cle].length; i++) { (function(macroText) {
                        createMacroElement(macroText)  // Create the macro button.
                    })(macroDict[cle][i])}
                }
            }
        })
    })
}

// When the extension is open.
document.addEventListener('DOMContentLoaded', function() {

    var activeTabId
    doInCurrentTab(function (tab) {
        activeTabId = tab.id
    })
    // Load the macro dictionary and create it if not already defined.
    chrome.storage.local.get(['macroDict'], function(result) {
        if (result.macroDict == "{}" || result.macroDict == undefined) {
            // If the dictionary is empty or does not exist,
            // create it by adding the default category.
            var macroDict = {}
            macroDict[defaultCat] = []
            chrome.storage.local.set({'macroDict': JSON.stringify(macroDict)})
        } else {  // If the dictionary exists, load it normally.
            var macroDict = JSON.parse(result.macroDict)
            if (!macroDict.hasOwnProperty(defaultCat)) {
                // If the dictionary does not contain the default category, add it.
                macroDict[defaultCat] = []
                chrome.storage.local.set({'macroDict': JSON.stringify(macroDict)})
            }
        }
        // Updated contextual menus.
        chrome.contextMenus.removeAll()
        for (var cat of Object.keys(macroDict)) {
            // Creation of a parent menu for each macro category.
            var catMenu = chrome.contextMenus.create({
                title: cat,
                contexts: ["all"]
            })
            for (var i = 0; i < macroDict[cat].length; i++) {
                // Create a sub-menu for each macro.
                (function(cat, i) {
                    chrome.contextMenus.create({
                        title: macroDict[cat][i].slice(0, 65),
                        parentId: catMenu,
                        contexts: ["all"],
                        onclick: function() {
                            // Execute the inject(text) function when the menu is clicked.
                            console.log(macroDict[cat][i])
                            chrome.scripting.executeScript({
                                target: { tabId: activeTabId },
                                func: inject,
                                args: [macroDict[cat][i]]
                            })
                        }
                    })
                })(cat, i)
            }
        }
        // Add a separator if text is selected.
        chrome.contextMenus.create({
            id: "sep1",
            type: "separator",
            contexts: ["all"],
        })
        // Context menu to create a macro with the selected text.
        chrome.contextMenus.create({
            id: "createMacro",
            title: 'Create a macro "%s"',
            contexts: ["selection"],
            onclick: function(info) {
                // Create a macro with the selected text.
                // Remove spaces and line breaks at the end of selected text.
                var macroText = info.selectionText.trimRight().replace(/\n$/, '')
                // Check that the text is not empty and that it doesn't already exist in the same category.
                if (macroText && !macroDict[window.value].includes(macroText)) {
                    createMacroElement(macroText)
                    // Add the macro to the macro dictionary and save it in the localstorage.
                    macroDict[window.value].push(macroText)
                    chrome.storage.local.set({'macroDict': JSON.stringify(macroDict)})
                }
            }
        })
        // Add a separator if text is selected.
        chrome.contextMenus.create({
            id: "sep2",
            type: "separator",
            contexts: ["selection"],
        })
        // Right-click context menu to copy a macro.
        chrome.contextMenus.create({
            id: "copyContent",
            title: "Copy macro",
            contexts: ["all"],
            onclick: function() {  // Copy the selected button.
                var bouton = document.activeElement
                navigator.clipboard.writeText(bouton.title)
            }
        })
        // Right-click context menu to delete macros.
        chrome.contextMenus.create({
            id: "deleteButton",
            title: "Delete button",
            contexts: ["all"],
            onclick: function() {  // Delete the selected button.
                var bouton = document.activeElement
                // Delete the selected category.
                if (bouton.id == "cat" && bouton.title !== defaultCat) {
                    delete macroDict[bouton.title]
                    bouton.remove()
                // Delete the selected macro.
                } else if (bouton.id == "macro") {
                    var iboutoSupr = macroDict[window.value].indexOf(bouton.title)
                    if (iboutoSupr !== -1) {
                        macroDict[window.value].splice(iboutoSupr, 1)
                    }
                    bouton.remove()
                }
                chrome.storage.local.set({'macroDict': JSON.stringify(macroDict)})
            }
        })
        chrome.contextMenus.create({
            id: "sep3",
            type: "separator",
            contexts: ["all"],
        })
        var catMenu = chrome.contextMenus.create({
            title: "Import / Export macros",
            contexts: ["all"]
        })
        // Context menu to copy macro dictionary to json.
        chrome.contextMenus.create({
            id: "copyDict",
            title: "Copy macros to clipboard",
            contexts: ["all"],
            parentId: catMenu,
            onclick: function() {
                chrome.storage.local.get(['macroDict'], function(result) {
                    navigator.clipboard.writeText(result.macroDict)
                })
            }
        })
        // Context menu to load the macro dictionary in json.
        chrome.contextMenus.create({
            id: "loadDict",
            title: "Load macros from input",
            contexts: ["all"],
            parentId: catMenu,
            onclick: function() {
                var macroDict = document.getElementById("TextInput").value;
                try {  // Tests whether macroDict is a valid JSON.
                    JSON.parse(macroDict);
                    chrome.storage.local.set({'macroDict': macroDict});
                    loadElements();
                } catch (e) {
                    console.error("Error: The value is not a valid JSON.");
                }
            }
        })
    })

    loadElements()  // Load items from localstorage.
})

// Create a new macro if the New macro button is clicked.
document.getElementById('addMacro').addEventListener('click', function() {
    var macroText = document.getElementById("TextInput").value
    macroText = macroText.trimRight().replace(/\n$/, '')  // Delete spaces and line breaks at the end.
    chrome.storage.local.get('macroDict', function (result) {
        var macroDict = JSON.parse(result.macroDict)
        // Check that the text is not empty and that it doesn't already exist in the same category.
        if (macroText && !macroDict[window.value].includes(macroText)) {
            createMacroElement(macroText)
            // Add the macro to the macro dictionary and save it in the localstorage.
            macroDict[window.value].push(macroText)
            chrome.storage.local.set({'macroDict': JSON.stringify(macroDict)})
        }
    })
})

// Create a new macro category if the New Category button is clicked.
document.getElementById('addCategoryButton').addEventListener('click', function() {
    var catName = document.getElementById("TextInput").value
    catName = catName.trimRight().replace(/\n$/, '')  // Delete spaces and line breaks at the end.
    chrome.storage.local.get('macroDict', function (result) {
        var macroDict = JSON.parse(result.macroDict)
        // Check that the text is not empty and that a category with the same name does not already exist.
        if (catName && !macroDict.hasOwnProperty(catName)) {
            createCatElement(catName)
            // Add the category to the macro dictionary and save it in localstorage.
            macroDict[catName] = []
            chrome.storage.local.set({'macroDict': JSON.stringify(macroDict)})
        }
    })
})

// Load default category if back button is clicked.
document.getElementById('racineCat').addEventListener('click', function () {
    changeCat(defaultCat)
})
