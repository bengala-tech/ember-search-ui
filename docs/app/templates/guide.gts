import { pageTitle } from 'ember-page-title';
import GuidePage from '../docs-site/guide-page.gts';
import type { Guide } from '../guides/index.ts';

<template>
  {{pageTitle @model.doc.title}}
  <GuidePage @guide={{@model}} />
</template> satisfies import('@ember/component/template-only').TOC<{
  Args: { model: Guide };
}>;
