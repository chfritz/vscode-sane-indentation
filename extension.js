const vscode = require('vscode');

const log = (...args) => console.log('sane-indentation', ...args);
  // global.saneDebug && console.log('sane-indentation', ...args);
// const log = () => {};

// TODO: read from settings
const languageScopes = {
  javascript: {
    indent: {
      array: true,
      object: true,
      arguments: true,
      statement_block: true,
      class_body: true,
      parenthesized_expression: true,
      jsx_element: true,
      jsx_opening_element: true,
      jsx_expression: true,
      switch_body: true,
      named_imports: true,
      import_statement: true,
      object_type: true,
      enum_body: true,
      union_type: true,
      formal_parameters: true,
      object_pattern: true,
    },
    indentExceptFirst: {
      member_expression: true,
      assignment_expression: true,
      expression_statement: true,
      variable_declarator: true,
      lexical_declaration: true,
      binary_expression: true,
      jsx_self_closing_element: true,
      switch_case: true,
      switch_default: true,
    },
    indentExceptFirstOrBlock: {
      if_statement: true,
      while_statement: true,
    },
    types: {
      indent: {
        description: true,
        arguments: true,
      },
      outdent: {
        else: true
      }
    }
  },

  shellscript: {
    indent: {
      if_statement: true,
      while_statement: true,
      do_group: true,
      else_clause: true,
      elif_clause: true,
      compound_statement: true,
    },
    indentExceptFirst: {
      case_item: true,
    },
    indentExceptFirstOrBlock: {
    },
    types: {
      indent: {
      },
      outdent: {
        else_clause: true,
        elif_clause: true,
      }
    }
  }
};
languageScopes.javascriptreact = languageScopes.javascript;
languageScopes.typescript = languageScopes.javascript;
languageScopes.typescriptreact = languageScopes.javascript;
languageScopes.jsonc = languageScopes.javascript;
languageScopes.json = languageScopes.javascript;


/** Walk up the tree. Everytime we meet a scope type, check whether we
  are coming from the first (resp. last) child. If so, we are opening
  (resp. closing) that scope, i.e., do not count it. Otherwise, add 1.

  This is the core function.

  It might make more sense to reverse the direction of this walk, i.e.,
  go from root to leaf instead.
*/
const treeWalk = (node, scopes, lastScope = null) => {
  if (node == null || node.parent == null) {
    return 0;
  } else {

    let increment = 0;

    const notFirstOrLastSibling =
      (node.previousSibling != null && node.nextSibling != null);

    const isScope = scopes.indent[node.parent.type];
    (notFirstOrLastSibling && isScope && increment++);

    const isScope2 = scopes.indentExceptFirst[node.parent.type];
    (!increment && isScope2 && node.previousSibling != null && increment++);

    const isScope3 = scopes.indentExceptFirstOrBlock[node.parent.type];
    (!increment && isScope3 && node.previousSibling != null && increment++);

    // apply current row, single line, type-based rules, e.g., 'else' or 'private:'
    let typeDent = 0;
    scopes.types.indent[node.type] && typeDent++;
    scopes.types.outdent[node.type] && increment && typeDent--;
    increment += typeDent;

    // check whether the last (lower) indentation happend due to a scope that
    // started on the same row and ends directly before this.
    // TODO: this currently only works for scopes that have a single-character
    // closing delimiter (like statement_blocks, but not HTML, for instance).
    if (lastScope && increment > 0
      && // previous scope was a two-sided scope, reduce if starts on same row
      // and ends right before
      ((node.parent.startPosition.row == lastScope.node.startPosition.row
        && (node.parent.endIndex <= lastScope.node.endIndex + 1))
        // or this is a special scope (like if, while) and it's ends coincide
        || (isScope3 && (lastScope.node.endIndex == node.endIndex
            || node.parent.endIndex == node.endIndex) ))) {

      log('ignoring repeat', node.parent.type, lastScope.node.type);
      increment = 0;
    } else { lastScope &&
      log(node.parent.startPosition.row,
        lastScope.node.startPosition.row,
        node.parent.endIndex,
        lastScope.node.endIndex,
        isScope3,
        node.endIndex);
    }

    log('treewalk', {node, lastScope, notFirstOrLastSibling, type: node.parent.type, increment});
    const newLastScope = (isScope || isScope2 ? {node: node.parent} : lastScope);
    return treeWalk(node.parent, scopes, newLastScope) + increment;
  }
};

const ensureIndentation = (line, currentIndentation, indentation, {textEditor, edit}) => {
  log('ensureIndentation', line, currentIndentation, indentation);

  const tabSize = textEditor.options.tabSize;
  // TODO: also use editorSettings.insertSpaces to see whether to use tabs or spaces

  // now ensure we are indented "result" on the current line
  const missing = (indentation * tabSize) - currentIndentation; // TODO: use tab/spaces from settings
  const insertionPoint = new vscode.Position(line, 0);
  // vscode.window.showInformationMessage(`Sane: ${result}, ${missing}`);

  if (missing > 0) {
    const toInsert = Array(missing + 1).join(' ');
    edit.insert(insertionPoint, toInsert);
  } else if (missing < 0) {
    edit.delete(new vscode.Range(
      new vscode.Position(line, indentation * tabSize),
      new vscode.Position(line, currentIndentation)));
  }
};

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

  // for debugging
  global.vscode = vscode;

  const parseTreeExtension = vscode.extensions.getExtension("pokey.parse-tree");
  if (parseTreeExtension == null) {
    throw new Error("Depends on pokey.parse-tree extension");
  }
  const { getNodeAtLocation } = await parseTreeExtension.activate();

  /** indent the given line number */
  const indentLine = (line, {textEditor, edit}) => {
    // console.log('indentLine', line);

    const scopes = languageScopes[textEditor.document.languageId];
    if (!scopes) {
      console.warn('no scopes defined for language',
        textEditor.document.languageId, ', falling back to reindent command');
      vscode.commands.executeCommand('editor.action.reindentselectedlines');
      return;
    }

    const currentLine = textEditor.document.lineAt(line).text;
    // find beginning of the line
    let character = currentLine.search(/\S/);
    let altLine = line;
    // if the current line is empty, find *last* character on last non-empty line
    while (character < 0 && altLine > 0) {
      altLine--;
      const currentLine = textEditor.document.lineAt(altLine).text;
      character = currentLine.search(/\S\s*/);
    }

    if (altLine == 0) {
      character = currentLine.search(/\S\s*/);
      log(line, character);
      ensureIndentation(line, character >= 0 ? character :
        textEditor.document.lineAt(line).text.length, 0,
        {textEditor, edit});
      return;
    }

    try {
      let node = getNodeAtLocation({
        range: {start: {line, character}},
        uri: textEditor.document.uri
      });

      // walk up the tree to find highest node that still start here
      while (node && node.parent
        && node.parent.startPosition.row == node.startPosition.row
        && node.parent.endPosition.row == node.startPosition.row
        && node.parent.startPosition.column == node.startPosition.column
      ) {
          node = node.parent;
       }

      // To see what else is available on `node`:
      // console.log(node, node.parent, node.type,
      //   Object.getOwnPropertyNames(Object.getPrototypeOf(node))
      // );

      const result = treeWalk(node, scopes);
      ensureIndentation(line, character, result, {textEditor, edit});

    } catch (e) {
      console.error(e);
    }
  };


  const onCommand = (textEditor, edit) => {
    log("sane-indentation", textEditor, edit);
    const {start, end} = textEditor.selection;
    log("sane-indentation", {start, end});

    for (let line = start.line; line <= end.line; line++) {
      indentLine(line, {textEditor, edit});
    }
  };


  let disposable = vscode.commands.registerTextEditorCommand(
    'sane-indentation.indentLine', onCommand);
  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate
}
