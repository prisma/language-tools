import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

suite('Should get linting', () => {
	const docUri = getDocUri('linting.MissingArgument.prisma')
	const docUri2 = getDocUri('linting.WrongType.prisma')
	const docUri3 = getDocUri('linting.RequiredField.prisma')


	test('Diagnoses missing argument', async () => {
		await testDiagnostics(docUri, [
			{ message: 'Argument "provider" is missing in data source block "db".', range: toRange(0, 0, 2, 1), severity: vscode.DiagnosticSeverity.Error, source: '' }
		]);
	});
	test('Diagnoses wrong type', async () => {
		await testDiagnostics(docUri2, [
			{ message: 'Type "Use" is neither a built-in type, nor refers to another model, custom type, or enum.', range: toRange(14, 12, 14, 16), severity: vscode.DiagnosticSeverity.Error, source: '' }
		]);
	});
	test('Diagnoses required field', async () => {
		await testDiagnostics(docUri3, [
			{ message: 'Error validating: The relation field `author` uses the scalar fields authorId. At least one of those fields is required. Hence the relation field must be required as well.', range: toRange(14, 2, 14, 67), severity: vscode.DiagnosticSeverity.Error, source: '' }
		]);
	});
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
	const start = new vscode.Position(sLine, sChar);
	const end = new vscode.Position(eLine, eChar);
	return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
	await activate(docUri)

	const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

	assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
		const actualDiagnostic = actualDiagnostics[i];
		assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
		assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
		assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
	});
}