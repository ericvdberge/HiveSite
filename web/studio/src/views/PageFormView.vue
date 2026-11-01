<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import NotFoundScreen from '../components/NotFoundScreen.vue'
import ScreenHead from '../components/ScreenHead.vue'
import { api, fieldKey, isApiError, type components } from '../api'
import { rememberAddedPage } from '../composables/useAddedPage'
import { clearSiteNav, setSiteNav } from '../composables/useSiteNav'
import { dismissToast, showErrorToast, toastCopy } from '../composables/useToast'
import {
    FIELD_ORDER,
    LIMITS,
    NOT_ACCEPTED_COPY,
    SERVER_FIELD_COPY,
    SLUG_RESERVED_COPY,
    SLUG_TAKEN_COPY,
    TOO_MANY_COPY,
    checkField,
    count,
    formField,
    suggestSlug,
    type FieldName,
} from '../pageForm'

type Site = components['schemas']['SiteDto']
type PageItem = components['schemas']['PageDto']
type Patch = components['schemas']['PagePatchDto']

const route = useRoute()
const router = useRouter()
// Add lives at /sites/:id/pages/new (id is the site); edit at /pages/:id/edit (id is the page).
const isEdit = route.path.startsWith('/pages/')
const routeId = String(route.params.id)

const values = reactive<Record<FieldName, string>>({ title: '', slug: '' })
const site = ref<Site | null>(null)
const saved = ref<PageItem | null>(null)
const phase = ref<'loading' | 'ready' | 'failed' | 'missing-site' | 'missing-page'>('loading')
const sending = ref(false)
const typed = reactive(new Set<FieldName>())
const shown = reactive(new Set<FieldName>())
const serverErrors = reactive<Partial<Record<FieldName, string>>>({})
const formMessage = ref('')
const tooMany = ref(false)
const status = ref('')
const limitNote = ref('')
const slugEdited = ref(false)
const messageEl = ref<HTMLElement | null>(null)

// Aborted on unmount: a cancel is not a failure and shows nothing.
const controller = new AbortController()

const ids: Record<FieldName, string> = { title: 'page-title', slug: 'page-slug' }
const labels: Record<FieldName, string> = { title: 'Title', slug: 'Slug' }
const hints: Record<FieldName, string> = {
    title: 'Used in the menu and as the page title.',
    slug: 'Lowercase letters, digits and hyphens. Starts and ends with a letter or digit. Not "assets".',
}

const siteId = computed(() => (isEdit ? (saved.value?.site_id ?? '') : routeId))
const pagesPath = computed(() => (siteId.value ? `/sites/${siteId.value}/pages` : '/'))
const isHome = computed(() => saved.value !== null && Number(saved.value.menu_order) === 0)
const siteSlug = computed(() => site.value?.slug ?? '')

/** A server error stays until the field changes; a client error shows once the field was visited. */
function fieldError(field: FieldName): string {
    return serverErrors[field] || (shown.has(field) ? checkField(field, values[field]) : '')
}

const counts = computed(() => ({ title: count(values.title), slug: count(values.slug) }))

function onInput(field: FieldName): void {
    typed.add(field)
    serverErrors[field] = ''
    status.value = ''
    if (field === 'slug') slugEdited.value = values.slug !== ''
    if (field === 'title' && !isEdit && !slugEdited.value) {
        values.slug = suggestSlug(values.title)
        serverErrors.slug = ''
    }
}

function onBlur(field: FieldName): void {
    if (typed.has(field)) shown.add(field)
}

// "Limit reached" is said once, when a count first reaches its maximum.
for (const field of FIELD_ORDER) {
    watch(
        () => counts.value[field],
        (now, before) => {
            if (now === LIMITS[field] && before < now) {
                limitNote.value = `${labels[field]}: limit reached`
            }
        },
    )
}

const pathPreview = computed(() => `/s/${siteSlug.value}/${values.slug.trim() || '…'}`)
const slugChanged = computed(
    () =>
        isEdit &&
        saved.value !== null &&
        values.slug.trim() !== '' &&
        values.slug.trim() !== saved.value.slug,
)
const loadError = isEdit ? "We couldn't load this page." : "We couldn't load this site."
const documentTitle = computed(() =>
    isEdit && saved.value ? `Edit page · ${saved.value.title} · Hivesite Studio` : undefined,
)
const heading = isEdit ? 'Edit page' : 'New page'

function fill(page: PageItem): void {
    saved.value = page
    values.title = page.title
    values.slug = page.slug
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function isAbort(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError'
}

async function fetchSite(id: string): Promise<Site> {
    const { data } = await api.GET('/sites/{id}', {
        params: { path: { id } },
        signal: controller.signal,
    })
    if (!data) throw new Error('Empty response')
    return data
}

async function load(): Promise<void> {
    phase.value = 'loading'
    try {
        if (isEdit) {
            const { data } = await api.GET('/pages/{id}', {
                params: { path: { id: routeId } },
                signal: controller.signal,
            })
            if (!data) throw new Error('Empty response')
            site.value = await fetchSite(data.site_id)
            fill(data)
        } else {
            site.value = await fetchSite(routeId)
        }
        setSiteNav({ id: site.value.id, name: site.value.name })
        phase.value = 'ready'
    } catch (error) {
        if (isAbort(error)) return
        // Sign-in owns a 401 (shell.md).
        if (isApiError(error) && error.code === 'unauthenticated') return
        if (isApiError(error) && error.code === 'page_not_found' && isEdit) {
            phase.value = 'missing-page'
            return
        }
        if (isApiError(error) && error.code === 'site_not_found' && !isEdit) {
            phase.value = 'missing-site'
            return
        }
        phase.value = 'failed'
    }
}

async function focusFirstInvalid(): Promise<void> {
    await nextTick()
    const first = FIELD_ORDER.find((f) => fieldError(f) !== '')
    if (first) document.getElementById(ids[first])?.focus()
}

/** Only the fields whose trimmed value differs; never `menu_order`. */
function buildPatch(page: PageItem): Patch {
    const patch: Patch = {}
    if (values.title.trim() !== page.title) patch.title = values.title.trim()
    if (values.slug.trim() !== page.slug) patch.slug = values.slug.trim()
    return patch
}

async function submit(): Promise<void> {
    if (sending.value || tooMany.value) return
    formMessage.value = ''
    status.value = ''
    FIELD_ORDER.forEach((f) => shown.add(f))
    if (FIELD_ORDER.some((f) => fieldError(f) !== '')) {
        await focusFirstInvalid()
        return
    }
    if (isEdit && saved.value) {
        const patch = buildPatch(saved.value)
        if (Object.keys(patch).length === 0) {
            status.value = 'No changes to save.'
            return
        }
        await send(() =>
            api.PATCH('/pages/{id}', {
                params: { path: { id: routeId } },
                body: patch,
                signal: controller.signal,
            }),
        )
    } else {
        await send(() =>
            api.POST('/sites/{id}/pages', {
                params: { path: { id: routeId } },
                body: { title: values.title.trim(), slug: values.slug.trim() },
                signal: controller.signal,
            }),
        )
    }
}

async function send(call: () => Promise<{ data?: PageItem }>): Promise<void> {
    sending.value = true
    try {
        const { data } = await call()
        // Left the screen while the request was out: nothing more to do here.
        if (controller.signal.aborted) return
        if (!data) throw new Error('Empty response')
        dismissToast()
        if (isEdit) {
            fill(data)
            status.value = `Saved. Last updated ${formatDate(data.updated_at)}.`
        } else {
            rememberAddedPage({ id: data.id, title: data.title })
            await router.push(pagesPath.value)
        }
    } catch (error) {
        if (!isAbort(error) && !controller.signal.aborted) await showFailure(error)
    } finally {
        sending.value = false
    }
}

async function showFailure(error: unknown): Promise<void> {
    if (!isApiError(error)) return showErrorToast(toastCopy.saveFailed('page'))
    if (error.code === 'unauthenticated') return
    if (error.code === 'invalid_request') {
        const field = formField(fieldKey(error.field))
        if (field) {
            serverErrors[field] = SERVER_FIELD_COPY[field]
            await focusFirstInvalid()
        } else {
            await showMessage(NOT_ACCEPTED_COPY)
        }
        return
    }
    if (error.code === 'slug_taken' || error.code === 'slug_reserved') {
        serverErrors.slug = error.code === 'slug_taken' ? SLUG_TAKEN_COPY : SLUG_RESERVED_COPY
        await focusFirstInvalid()
        return
    }
    if (error.code === 'too_many_pages' && !isEdit) {
        tooMany.value = true
        await showMessage(TOO_MANY_COPY)
        return
    }
    if (error.code === 'site_not_found' && !isEdit) {
        phase.value = 'missing-site'
        return
    }
    if (error.code === 'page_not_found' && isEdit) {
        phase.value = 'missing-page'
        return
    }
    showErrorToast(toastCopy.saveFailed('page'))
}

async function showMessage(text: string): Promise<void> {
    formMessage.value = text
    await nextTick()
    messageEl.value?.focus()
}

function describedBy(field: FieldName): string {
    const id = ids[field]
    return [`${id}-hint`, `${id}-count`, fieldError(field) ? `${id}-error` : '']
        .filter(Boolean)
        .join(' ')
}

/** Cancel and Edit blocks leave the form; they do nothing while a request is out. */
function go(e: MouseEvent, navigate: (e?: MouseEvent) => unknown): void {
    if (sending.value) e.preventDefault()
    else navigate(e)
}

onMounted(() => {
    void load()
})
onBeforeUnmount(() => {
    controller.abort()
    clearSiteNav()
})
</script>

<template>
    <NotFoundScreen v-if="phase === 'missing-site'" code="site_not_found" />
    <NotFoundScreen
        v-else-if="phase === 'missing-page'"
        code="page_not_found"
        :pages-to="siteId ? pagesPath : undefined"
    />
    <template v-else>
        <ScreenHead :title="heading" :eyebrow="site?.name" :document-title="documentTitle">
            <template v-if="isEdit && saved" #actions>
                <RouterLink v-slot="{ href, navigate }" custom :to="`/pages/${saved.id}/blocks`">
                    <a
                        class="hs-button hs-button--secondary"
                        :href="href"
                        :aria-disabled="sending ? 'true' : undefined"
                        @click="go($event, navigate)"
                        >Edit blocks</a
                    >
                </RouterLink>
            </template>
        </ScreenHead>

        <!-- One status region while the form is not ready; its text changes, the element stays. -->
        <p v-if="phase !== 'ready'" class="hs-visually-hidden" role="status">
            {{ phase === 'failed' ? `Error: ${loadError}` : 'Loading…' }}
        </p>

        <div v-if="phase === 'loading'" class="hs-form" aria-busy="true">
            <div v-for="n in 2" :key="n" class="hs-skeleton" aria-hidden="true">
                <span class="hs-skeleton__shape hs-skeleton__shape--label" />
                <span class="hs-skeleton__shape hs-skeleton__shape--control" />
            </div>
        </div>

        <div v-else-if="phase === 'failed'" class="hs-form">
            <p class="hs-form-message"><strong>Error:</strong> {{ loadError }}</p>
            <button
                type="button"
                class="hs-button hs-button--secondary hs-form__retry"
                @click="load()"
            >
                Try again
            </button>
        </div>

        <form v-else class="hs-form" novalidate @submit.prevent="submit">
            <div
                v-if="formMessage"
                id="page-form-message"
                ref="messageEl"
                class="hs-form-message"
                role="alert"
                tabindex="-1"
            >
                <strong>Error:</strong> {{ formMessage }}
            </div>

            <div v-for="field in FIELD_ORDER" :key="field" class="hs-field">
                <label :for="ids[field]"
                    >{{ labels[field] }} <span class="hs-field__req">(required)</span></label
                >
                <p :id="`${ids[field]}-hint`" class="hs-field__hint">{{ hints[field] }}</p>
                <input
                    :id="ids[field]"
                    v-model="values[field]"
                    type="text"
                    :name="field"
                    :autocapitalize="field === 'slug' ? 'none' : undefined"
                    :spellcheck="field === 'slug' ? false : undefined"
                    :readonly="sending"
                    :aria-invalid="fieldError(field) ? 'true' : undefined"
                    :aria-describedby="describedBy(field)"
                    @input="onInput(field)"
                    @blur="onBlur(field)"
                />
                <div class="hs-field__foot">
                    <p v-if="fieldError(field)" :id="`${ids[field]}-error`" class="hs-field__error">
                        <strong>Error:</strong> {{ fieldError(field) }}
                    </p>
                    <p
                        :id="`${ids[field]}-count`"
                        class="hs-counter"
                        :class="{ 'hs-counter--over': counts[field] > LIMITS[field] }"
                    >
                        {{ counts[field] }} of {{ LIMITS[field] }}
                    </p>
                </div>
                <template v-if="field === 'slug'">
                    <p class="hs-path-preview">
                        Public path: <span class="hs-path">{{ pathPreview }}</span>
                    </p>
                    <p v-if="isHome" class="hs-path-preview">
                        As the home page it is also served at
                        <span class="hs-path">/s/{{ siteSlug }}/</span>.
                    </p>
                    <div v-if="slugChanged && saved" class="hs-note" role="status">
                        <strong>Note:</strong> This page's public path changes from
                        <span class="hs-path">/s/{{ siteSlug }}/{{ saved.slug }}</span> to
                        <span class="hs-path">/s/{{ siteSlug }}/{{ values.slug.trim() }}</span
                        >. Old links may stop working.
                        <template v-if="isHome">
                            Your home page stays at <span class="hs-path">/s/{{ siteSlug }}/</span>.
                        </template>
                    </div>
                </template>
            </div>
            <p class="hs-visually-hidden" role="status">{{ limitNote }}</p>

            <div class="hs-form__actions">
                <button
                    type="submit"
                    class="hs-button"
                    :aria-disabled="sending || tooMany ? 'true' : undefined"
                    :aria-describedby="tooMany ? 'page-form-message' : undefined"
                >
                    {{
                        isEdit
                            ? sending
                                ? 'Saving…'
                                : 'Save changes'
                            : sending
                              ? 'Adding…'
                              : 'Add page'
                    }}
                </button>
                <RouterLink v-slot="{ href, navigate }" custom :to="pagesPath">
                    <a
                        class="hs-button hs-button--secondary"
                        :href="href"
                        :aria-disabled="sending ? 'true' : undefined"
                        @click="go($event, navigate)"
                        >Cancel</a
                    >
                </RouterLink>
                <p class="hs-form__status" role="status">{{ status }}</p>
            </div>
        </form>
    </template>
</template>

<style scoped>
.hs-form {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    max-inline-size: var(--hs-layout-content-width);
}

.hs-field {
    display: flex;
    flex-direction: column;
}

label {
    margin-block-end: var(--hs-space-2);
    font-size: var(--hs-font-size-body-s);
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-text);
}

.hs-field__req {
    font-weight: var(--hs-font-weight-text);
    color: var(--hs-color-text-muted);
}

.hs-field__hint {
    margin-block-end: var(--hs-space-1);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

input {
    inline-size: 100%;
    min-block-size: var(--hs-control-min-height);
    padding: var(--hs-control-padding-y) var(--hs-control-padding-x);
    background: var(--hs-color-surface-sunk);
    border: var(--hs-border-width-control) solid var(--hs-color-border-strong);
    border-radius: var(--hs-radius-control);
    font-family: var(--hs-font-text);
    font-size: var(--hs-font-size-body);
    color: var(--hs-color-text);
}

input:hover {
    border-color: var(--hs-color-text-muted);
}

input:focus {
    border-color: var(--hs-color-focus);
}

input[aria-invalid='true'] {
    border-color: var(--hs-color-error);
}

.hs-field__foot {
    display: flex;
    justify-content: space-between;
    gap: var(--hs-space-3);
}

.hs-field__error {
    margin-block-start: var(--hs-space-2);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-error);
    animation: hs-fade var(--hs-motion-duration-base) var(--hs-motion-easing-standard) both;
}

.hs-field__error strong {
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-error);
}

.hs-counter {
    flex-shrink: 0;
    margin-block-start: var(--hs-space-2);
    margin-inline-start: auto;
    font-family: var(--hs-font-label);
    font-size: var(--hs-font-size-label);
    letter-spacing: var(--hs-letter-spacing-body);
    color: var(--hs-color-text-muted);
}

.hs-counter--over {
    color: var(--hs-color-error);
}

.hs-path-preview {
    margin-block-start: var(--hs-space-2);
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
    overflow-wrap: anywhere;
}

.hs-note {
    padding: var(--hs-space-4);
    background: var(--hs-color-surface);
    border-inline-start: var(--hs-border-width-focus) solid var(--hs-color-error);
    color: var(--hs-color-text);
    animation: hs-fade var(--hs-motion-duration-base) var(--hs-motion-easing-standard) both;
}

.hs-note {
    margin-block-start: var(--hs-space-3);
    border-inline-start-color: var(--hs-color-rule);
    overflow-wrap: anywhere;
}

.hs-note strong {
    font-weight: var(--hs-font-weight-text-strong);
    color: var(--hs-color-accent-text);
}

@keyframes hs-fade {
    from {
        opacity: 0;
    }
}

.hs-form__actions {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    margin-block-start: var(--hs-space-6);
}

.hs-form__actions .hs-button {
    inline-size: 100%;
}

.hs-form__retry {
    align-self: flex-start;
}

.hs-form__status {
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

/* Loading placeholder: a label and a control for each of the two fields. */
.hs-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
}

.hs-skeleton__shape {
    display: block;
    background: var(--hs-color-placeholder-media);
    border-radius: var(--hs-radius-card);
    animation: hs-pulse var(--hs-motion-duration-slower) var(--hs-motion-easing-standard) infinite
        alternate;
}

.hs-skeleton__shape--label {
    block-size: calc(var(--hs-font-size-body-s) * var(--hs-line-height-body));
    inline-size: 25%;
}

.hs-skeleton__shape--control {
    block-size: var(--hs-control-min-height);
}

@keyframes hs-pulse {
    to {
        background: var(--hs-color-surface-sunk);
    }
}

@media (prefers-reduced-motion: reduce) {
    .hs-skeleton__shape {
        animation-name: none;
    }
}

@media (width >= breakpoint(sm)) {
    .hs-form__actions {
        flex-direction: row;
        align-items: center;
    }

    .hs-form__actions .hs-button {
        inline-size: auto;
    }
}
</style>
