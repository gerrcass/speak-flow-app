// Seam (c): Button closed-union contract (Button.mdx). This file is type-checked
// by `tsc --noEmit`: valid usages compile, invented props must error.
// RED test: fails until src/components/Button.tsx exists.
import { Button } from "../src/components/Button";

export function ValidRecordButton() {
  return (
    <Button variant="primary" size="md">
      Record Attempt
    </Button>
  );
}

export function ValidDangerButton() {
  return (
    <Button variant="danger" size="lg">
      Discard Attempt
    </Button>
  );
}

export function InvalidSize() {
  return (
    // @ts-expect-error closed union rejects invented sizes
    <Button size="huge">x</Button>
  );
}

export function InvalidVariant() {
  return (
    // @ts-expect-error closed union rejects invented variants
    <Button variant="weird">x</Button>
  );
}
