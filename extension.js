'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const
  fetch = require('node-fetch'),
  open = require('open'),
  vscode = require('vscode'),
  window = vscode.window,
  DEFAULT_ALTER_VISTA_KEY = '3DqZ2Rl83LUbFAAw8SOz',
  DEFAULT_LOOKUP_SELECTED_URL = 'https://www.bing.com/search?q=define%20';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('dictionary.google.translateSelected', (textEditor, edit) => {
    const configuration = vscode.workspace.getConfiguration('dictionary.google');

    open(`https://translate.google.com/#${encodeURI(configuration.translateFromLanguage)}/${encodeURI(configuration.translateToLanguage)}/${encodeURI(getSelectedText(textEditor))}`);
  }));

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('dictionary.lookupSelected', (textEditor, edit) => {
    const lookupURL = vscode.workspace.getConfiguration('dictionary.lookupSelected').lookupURL || DEFAULT_LOOKUP_SELECTED_URL;
    open(lookupURL + encodeURI(getSelectedText(textEditor)));
  }));

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('dictionary.thesaurus.lookupSelectedSynonyms', (textEditor, edit) => {
    open(`http://thesaurus.com/browse/${encodeURI(getSelectedText(textEditor))}`);
  }));

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('dictionary.alterVista.replaceSelectedWithSynonyms', (textEditor, edit) => {
    const
      selectedText = getSelectedText(textEditor),
      configuration = vscode.workspace.getConfiguration('dictionary.altervista'),
      lookupSynonymsTask = fetch(`http://thesaurus.altervista.org/thesaurus/v1?key=${configuration.apiKey || DEFAULT_ALTER_VISTA_KEY}&word=${encodeURIComponent(selectedText.toLowerCase())}&language=en_US&output=json`)
        .then(
          res => {
            if (res.status === 403) {
              throw new Error('Thesaurus service is too busy right now, please try again later or set your own API key in preferneces.');
            } else if (res.status === 404) {
              throw new Error('Cannot find the word selected, check spelling.');
            } else if (res.status !== 200) {
              throw new Error('Failed to contact server to lookup synonyms.');
            }

            return res.json().then(json => json.response.reduce((words, list) => {
              list.list.synonyms.split('|').forEach(word => {
                !~words.indexOf(word) && words.push({
                  label: word,
                  description: list.list.category
                });
              });

              return words;
            }, []).sort((x, y) => {
              let
                xx = x.description.toLowerCase(),
                yy = y.description.toLowerCase();

              if (xx === yy) {
                xx = x.label.toLowerCase();
                yy = y.label.toLowerCase();
              }

              return xx > yy ? 1 : xx < yy ? -1 : 0;
            })).catch(err => {
              throw new Error('Failed to understand server response, please submit a bug.');
            });
          },
          err => {
            throw new Error('Failed to contact server to lookup synonyms.');
          }
        ).catch(err => {
          window.showErrorMessage(err.message);
        });

    window.showQuickPick(lookupSynonymsTask).then(selectedWord => {
      textEditor.edit(edit => {
        setSelectedText(textEditor, edit, setCasing(selectedWord.label.replace(/\s\(.+\)$/, ''), getCasing(selectedText)));
      });
    });
  }));
}

function setCasing(text, casing) {
  const newText = [];

  for (let i = 0, l = text.length; i < l; i++) {
    switch (casing) {
    case 'uppercase':
      newText.push(text[i].toUpperCase());
      break;

    case 'title':
      let c = text[i];
      newText.push(i ? c.toLowerCase() : c.toUpperCase());
      break;

    default:
      newText.push(text[i].toLowerCase());
      break;
    }
  }

  return newText.join('');
}

function getCasing(text) {
  return (
    isLower(text[0]) ? 'lowercase' :
    isLower(text[1]) ? 'title' :
    'uppercase'
  );
}

function isLower(c) {
  return c.toLowerCase() === c;
}

function isUpper(c) {
  return c.toUpperCase() === c;
}

function getSelectionRange(textEditor) {
  let
    selection = textEditor.selection,
    start = selection.start,
    end = selection.end;

  if (start.line === end.line && start.character === end.character) {
    start = new vscode.Position(start.line, 0);
    end = new vscode.Position(
      start.line,
      textEditor.document.getText(
        new vscode.Range(
          start,
          new vscode.Position(start.line, Infinity)
        )
      ).length
    );
  }

  return new vscode.Range(start, end);
}

function setSelectedText(textEditor, edit, newText) {
  edit.replace(getSelectionRange(textEditor), newText);
}

function getSelectedText(textEditor) {
  return textEditor.document.getText(getSelectionRange(textEditor));
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}

exports.deactivate = deactivate;