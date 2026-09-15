# Custom domain setup

The site currently lives at **https://hyperscaleailabs.github.io/**. Nothing below
is required — it is here for whenever you want a domain of your own.

Pick **one** of the two shapes. You cannot have both as the primary.

---

## Option A — apex domain (`hyperscaleailabs.com`)

**1. At your registrar, create four A records** (and, if it supports IPv6, four AAAA
records). Host/name is `@` or blank, depending on the registrar.

| Type | Name | Value |
| --- | --- | --- |
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |
| AAAA | @ | `2606:50c0:8000::153` |
| AAAA | @ | `2606:50c0:8001::153` |
| AAAA | @ | `2606:50c0:8002::153` |
| AAAA | @ | `2606:50c0:8003::153` |

**2. Add a `www` CNAME** so both spellings work:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | www | `hyperscaleailabs.github.io.` |

**3. Tell GitHub.** Either through the UI — repo → **Settings** → **Pages** →
*Custom domain* → enter `hyperscaleailabs.com` → **Save** — or from the CLI:

```bash
gh api -X PUT repos/hyperscaleailabs/hyperscaleailabs.github.io/pages \
  -f 'cname=hyperscaleailabs.com' -F 'https_enforced=true'
```

Saving in the UI commits a `CNAME` file to the repository. If you use the API,
create it yourself so a later push does not wipe the setting:

```bash
echo 'hyperscaleailabs.com' > CNAME && git add CNAME && git commit -m "Add CNAME" && git push
```

**4. Wait, then enable HTTPS.** DNS takes anywhere from a few minutes to a few
hours. Once GitHub reports the domain as verified, tick **Enforce HTTPS** in
Settings → Pages. The certificate is issued by Let's Encrypt automatically; the
checkbox stays greyed out until it is ready.

---

## Option B — subdomain only (`www.hyperscaleailabs.com`)

Simpler, and the only option on registrars that forbid apex CNAMEs.

| Type | Name | Value |
| --- | --- | --- |
| CNAME | www | `hyperscaleailabs.github.io.` |

Then set the custom domain to `www.hyperscaleailabs.com` and, at the registrar,
add a redirect from the apex to `www`.

---

## Verifying

```bash
# Should return the four GitHub Pages addresses
dig +short hyperscaleailabs.com

# Should return hyperscaleailabs.github.io
dig +short www.hyperscaleailabs.com

# What GitHub thinks the state is
gh api repos/hyperscaleailabs/hyperscaleailabs.github.io/pages \
  --jq '{cname, status, https_certificate: .https_certificate.state, https_enforced}'
```

## Things that commonly go wrong

- **`CNAME` file disappears after a push.** It lives in the repo root and is part
  of the site. If you regenerate the site tree without it, Pages reverts to the
  `github.io` address. Keep it committed.
- **HTTPS checkbox stays greyed out.** The certificate cannot be issued until DNS
  resolves correctly from GitHub's side. Wait and re-check; it can take an hour.
- **`DNS_PROBE` / 404 right after saving.** Propagation. Check with `dig` rather
  than the browser, which caches aggressively.
- **Domain taken over warnings.** Enable *Verified domains* in your GitHub profile
  settings to stop anyone else pointing a repo at your domain.
- **Update the absolute URLs.** `sitemap.xml`, `robots.txt` and the `<link rel="canonical">`
  and `og:url` tags in each HTML file reference `hyperscaleailabs.github.io`.
  Search-and-replace them when the domain changes.
