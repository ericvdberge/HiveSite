<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import NotFoundScreen from '../components/NotFoundScreen.vue'
import ScreenHead from '../components/ScreenHead.vue'
import { api, fieldKey, isApiError, type components } from '../api'
import { dismissToast, showErrorToast, toastCopy } from '../composables/useToast'
import {
    DEFAULT_LANGUAGE,
    FIELD_ORDER,
    LIMITS,
    SERVER_FIELD_COPY,
    checkField,
    count,
    formField,
    suggestSlug,
    type FieldName,
} from '../siteForm'

type Site = components['schemas']['SiteDto']
type Patch = components['schemas']['SitePatchDto']

const route = useRoute()
const router = useRouter()
const siteId = typeof route.params.id === 'string' ? route.params.id : ''
const isEdit = siteId !== ''

const values = reactive<Record<FieldName, string>>({
    name: '',
    slug: '',
    language: isEdit ? '' : DEFAULT_LANGUAGE,
    description: '',
})
const saved = ref<Site | null>(null)
const phase = ref<'loading' | 'ready' | 'failed' | 'missing'>(isEdit ? 'loading' : 'ready')
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

// Aborted on unmount. Calls carry the signal, and send() stops once it is aborted:
// leaving mid-save navigates nowhere and shows nothing.
const controller = new AbortController()

const ids: Record<FieldName, string> = {
    name: 'site-name',
    slug: 'site-slug',
    language: 'site-language',
    description: 'site-description',
}
const labels: Record<FieldName, string> = {
    name: 'Name',
    slug: 'Slug',
    language: 'Language',
    description: 'Description',
}
const hints: Record<FieldName, string> = {
    name: 'The name visitors see.',
    slug: 'Lowercase letters, digits and hyphens. Starts and ends with a letter or digit.',
    language: 'For example en, nl or pt-BR.',
    description: 'Shown in search results.',
}

/** A server error stays until the field changes; a client error shows once the field was visited. */
function fieldError(field: FieldName): string {
    return serverErrors[field] || (shown.has(field) ? checkField(field, values[field]) : '')
}

const counts = computed(() => ({
    name: count(values.name),
    slug: count(values.slug),
    language: count(values.language),
    description: count(values.description),
}))

function onInput(field: FieldName): void {
    typed.add(field)
    serverErrors[field] = ''
    status.value = ''
    if (field === 'slug') slugEdited.value = values.slug !== ''
    if (field === 'name' && !isEdit && !slugEdited.value) values.slug = suggestSlug(values.name)
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

const pathPreview = computed(() => `/s/${values.slug.trim() || '…'}`)
const slugChanged = computed(
    () =>
        isEdit &&
        saved.value !== null &&
        values.slug.trim() !== '' &&
        values.slug.trim() !== saved.value.slug,
)
const heading = isEdit ? 'Site settings' : 'New site'

function fill(site: Site): void {
    saved.value = site
    values.name = site.name
    values.slug = site.slug
    values.language = site.settings.language
    values.description = site.settings.description
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

async function load(): Promise<void> {
    phase.value = 'loading'
    try {
        const { data } = await api.GET('/sites/{id}', {
            params: { path: { id: siteId } },
            signal: controller.signal,
        })
        if (!data) throw new Error('Empty response')
        fill(data)
        phase.value = 'ready'
    } catch (error) {
        if (isAbort(error)) return
        // Sign-in owns a 401 (shell.md).
        if (isApiError(error) && error.code === 'unauthenticated') return
        if (isApiError(error) && error.code === 'site_not_found') {
            phase.value = 'missing'
            return
        }
        // The inline message carries the announcement; no toast.
        phase.value = 'failed'
    }
}

async function focusFirstInvalid(): Promise<void> {
    await nextTick()
    const first = FIELD_ORDER.find((f) => fieldError(f) !== '')
    if (first) document.getElementById(ids[first])?.focus()
}

/** Only the fields whose trimmed value differs; an emptied Language is left out. */
function buildPatch(site: Site): Patch {
    const patch: Patch = {}
    const settings: NonNullable<Patch['settings']> = {}
    const name = values.name.trim()
    const slug = values.slug.trim()
    const language = values.language.trim()
    const description = values.description.trim()
    if (name !== site.name) patch.name = name
    if (slug !== site.slug) patch.slug = slug
    if (language !== '' && language !== site.settings.language) settings.language = language
    if (description !== site.settings.description) settings.description = description
    if (Object.keys(settings).length > 0) patch.settings = settings
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
            api.PATCH('/sites/{id}', {
                params: { path: { id: siteId } },
                body: patch,
                signal: controller.signal,
            }),
        )
    } else {
        await send(() =>
            api.POST('/sites', {
                signal: controller.signal,
                body: {
                    name: values.name.trim(),
                    slug: values.slug.trim(),
                    settings: {
                        language: values.language.trim() || DEFAULT_LANGUAGE,
                        description: values.description.trim(),
                    },
                },
            }),
        )
    }
}

async function send(call: () => Promise<{ data?: Site }>): Promise<void> {
    sending.value = true
    try {
        const { data } = await call()
        if (controller.signal.aborted) return
        if (!data) throw new Error('Empty response')
        dismissToast()
        if (isEdit) {
            fill(data)
            status.value = `Saved. Last updated ${formatDate(data.updated_at)}.`
        } else {
            await router.push(`/sites/${data.id}/pages`)
        }
    } catch (error) {
        if (!isAbort(error) && !controller.signal.aborted) await showFailure(error)
    } finally {
        sending.value = false
    }
}

async function showFailure(error: unknown): Promise<void> {
    if (!isApiError(error)) return showErrorToast(toastCopy.saveFailed('site'))
    if (error.code === 'unauthenticated') return
    if (error.code === 'invalid_request') {
        const field = formField(fieldKey(error.field))
        if (field) {
            serverErrors[field] = SERVER_FIELD_COPY[field]
            await focusFirstInvalid()
        } else {
            await showMessage(
                "Something in the form wasn't accepted. Please check it and try again.",
            )
        }
        return
    }
    if (error.code === 'slug_taken') {
        serverErrors.slug = 'Another site already uses this path. Try a different slug.'
        await focusFirstInvalid()
        return
    }
    if (error.code === 'too_many_sites') {
        tooMany.value = true
        await showMessage("You have 10 sites, the most for now. This site wasn't created.")
        return
    }
    if (error.code === 'site_not_found' && isEdit) {
        phase.value = 'missing'
        return
    }
    showErrorToast(toastCopy.saveFailed('site'))
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

onMounted(() => {
    if (isEdit) void load()
})
onBeforeUnmount(() => controller.abort())
</script>

<template>
    <NotFoundScreen v-if="phase === 'missing'" code="site_not_found" />
    <template v-else>
        <ScreenHead :title="heading" :eyebrow="isEdit && saved ? saved.name : undefined">
            <template v-if="isEdit && saved" #lead>
                Last updated
                <time :datetime="saved.updated_at">{{ formatDate(saved.updated_at) }}</time>
            </template>
        </ScreenHead>

        <!-- One status region while the site is not ready; its text changes, the element stays. -->
        <p
            v-if="phase === 'loading' || phase === 'failed'"
            class="hs-visually-hidden"
            role="status"
        >
            {{ phase === 'failed' ? "Error: We couldn't load this site." : 'Loading site…' }}
        </p>

        <div v-if="phase === 'loading'" class="hs-form" aria-busy="true">
            <div v-for="n in 4" :key="n" class="hs-skeleton" aria-hidden="true">
                <span class="hs-skeleton__shape hs-skeleton__shape--label" />
                <span class="hs-skeleton__shape hs-skeleton__shape--control" />
            </div>
        </div>

        <div v-else-if="phase === 'failed'" class="hs-load-error">
            <p class="hs-form-message"><strong>Error:</strong> We couldn't load this site.</p>
            <button type="button" class="hs-button hs-button--secondary" @click="load()">
                Try again
            </button>
        </div>

        <form v-else class="hs-form" novalidate @submit.prevent="submit">
            <div
                v-if="formMessage"
                id="site-form-message"
                ref="messageEl"
                class="hs-form-message"
                role="alert"
                tabindex="-1"
            >
                <strong>Error:</strong> {{ formMessage }}
            </div>

            <div v-for="field in FIELD_ORDER" :key="field" class="hs-field">
                <label :for="ids[field]"
                    >{{ labels[field] }}
                    <span v-if="field === 'name' || field === 'slug'" class="hs-field__req"
                        >(required)</span
                    ></label
                >
                <p :id="`${ids[field]}-hint`" class="hs-field__hint">{{ hints[field] }}</p>
                <textarea
                    v-if="field === 'description'"
                    :id="ids[field]"
                    v-model="values[field]"
                    :name="field"
                    rows="3"
                    :readonly="sending"
                    :aria-invalid="fieldError(field) ? 'true' : undefined"
                    :aria-describedby="describedBy(field)"
                    @input="onInput(field)"
                    @blur="onBlur(field)"
                />
                <input
                    v-else
                    :id="ids[field]"
                    v-model="values[field]"
                    type="text"
                    :name="field"
                    :autocapitalize="field === 'slug' || field === 'language' ? 'none' : undefined"
                    :spellcheck="field === 'slug' || field === 'language' ? false : undefined"
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
                    <div v-if="slugChanged && saved" class="hs-note" role="status">
                        <strong>Note:</strong> Your public path changes from
                        <span class="hs-path">/s/{{ saved.slug }}</span> to
                        <span class="hs-path">/s/{{ values.slug.trim() }}</span
                        >. Old links may stop working.
                    </div>
                </template>
            </div>
            <p class="hs-visually-hidden" role="status">{{ limitNote }}</p>

            <div class="hs-form__actions">
                <button
                    type="submit"
                    class="hs-button"
                    :aria-disabled="sending || tooMany ? 'true' : undefined"
                    :aria-describedby="tooMany ? 'site-form-message' : undefined"
                >
                    {{
                        isEdit
                            ? sending
                                ? 'Saving…'
                                : 'Save changes'
                            : sending
                              ? 'Creating…'
                              : 'Create site'
                    }}
                </button>
                <RouterLink
                    v-if="!isEdit"
                    class="hs-button hs-button--secondary"
                    to="/"
                    :aria-disabled="sending ? 'true' : undefined"
                    @click="(e: Event) => sending && e.preventDefault()"
                    >Cancel</RouterLink
                >
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

input,
textarea {
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

textarea {
    resize: vertical;
}

input:hover,
textarea:hover {
    border-color: var(--hs-color-text-muted);
}

input:focus,
textarea:focus {
    border-color: var(--hs-color-focus);
}

input[aria-invalid='true'],
textarea[aria-invalid='true'] {
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

.hs-form-message {
    animation: hs-fade var(--hs-motion-duration-base) var(--hs-motion-easing-standard) both;
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

.hs-load-error {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    max-inline-size: var(--hs-layout-content-width);
}

.hs-load-error .hs-button {
    align-self: flex-start;
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

.hs-form__status {
    font-size: var(--hs-font-size-body-s);
    color: var(--hs-color-text-muted);
}

/* Loading placeholder: a label and a control for each of the four fields. */
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
