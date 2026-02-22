--
-- PostgreSQL database dump
--

\restrict T1gIORRn4dz2tTnBTfuw9svhAec0PIcflvz6xyc9wz5ffoFXFMG6fqwKjRdAydi

-- Dumped from database version 15.16 (Debian 15.16-1.pgdg13+1)
-- Dumped by pg_dump version 15.16 (Debian 15.16-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: commentlikes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commentlikes (
    user_id integer NOT NULL,
    comment_id integer NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    parent_comment_id integer,
    user_id integer NOT NULL,
    content text NOT NULL,
    media json,
    likes integer DEFAULT 0,
    creation_date timestamp without time zone NOT NULL
);


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: directmessages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directmessages (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    recipient_id integer NOT NULL,
    content text NOT NULL,
    creation_date timestamp without time zone NOT NULL,
    read_at timestamp without time zone
);


--
-- Name: directmessages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directmessages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directmessages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directmessages_id_seq OWNED BY public.directmessages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    actor_id integer NOT NULL,
    type character varying(50) NOT NULL,
    post_id integer,
    project_id integer,
    comment_id integer,
    created_at timestamp without time zone NOT NULL,
    read_at timestamp without time zone
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: postcomments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postcomments (
    post_id integer NOT NULL,
    comment_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: postlikes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postlikes (
    user_id integer NOT NULL,
    post_id integer NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    content text NOT NULL,
    media json,
    project_id integer,
    creation_date timestamp without time zone NOT NULL,
    user_id integer NOT NULL,
    likes integer DEFAULT 0
);


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: postsaves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postsaves (
    user_id integer NOT NULL,
    post_id integer NOT NULL
);


--
-- Name: projectbuilders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projectbuilders (
    project_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: projectcomments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projectcomments (
    project_id integer NOT NULL,
    comment_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: projectfollows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projectfollows (
    user_id integer NOT NULL,
    project_id integer NOT NULL
);


--
-- Name: projectlikes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projectlikes (
    user_id integer NOT NULL,
    project_id integer NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    about_md text,
    status integer,
    likes integer DEFAULT 0,
    links json,
    tags json,
    media json,
    owner integer NOT NULL,
    creation_date timestamp without time zone NOT NULL
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: userfollows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.userfollows (
    follower_id integer NOT NULL,
    followed_id integer NOT NULL
);


--
-- Name: userlogininfo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.userlogininfo (
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL
);


--
-- Name: userpushtokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.userpushtokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    platform text,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: userpushtokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.userpushtokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userpushtokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.userpushtokens_id_seq OWNED BY public.userpushtokens.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    picture text,
    bio text,
    links json,
    settings json,
    creation_date timestamp without time zone NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: directmessages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directmessages ALTER COLUMN id SET DEFAULT nextval('public.directmessages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: userpushtokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userpushtokens ALTER COLUMN id SET DEFAULT nextval('public.userpushtokens_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: commentlikes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.commentlikes (user_id, comment_id) FROM stdin;
2	1
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comments (id, parent_comment_id, user_id, content, media, likes, creation_date) FROM stdin;
1	\N	2	***Welcome!***	[]	1	2026-02-22 06:13:57.140633
\.


--
-- Data for Name: directmessages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.directmessages (id, sender_id, recipient_id, content, creation_date, read_at) FROM stdin;
1	3	2	hey	2026-02-22 08:10:56.112458	\N
2	3	2	how are you	2026-02-22 08:11:00.098256	\N
3	3	2	whay are you doing	2026-02-22 08:11:14.220429	\N
4	3	2	hey	2026-02-22 08:12:51.507236	\N
5	3	2	you around	2026-02-22 08:12:57.274295	\N
6	3	2	what are you soing	2026-02-22 08:13:06.610077	\N
7	2	2	hey bro	2026-02-22 08:15:54.28045	\N
8	2	3	hi	2026-02-22 08:32:48.431032	\N
9	2	3	how are you	2026-02-22 08:32:58.835777	\N
10	2	3	send notify	2026-02-22 08:33:08.195841	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, actor_id, type, post_id, project_id, comment_id, created_at, read_at) FROM stdin;
17	3	2	direct_message	\N	\N	\N	2026-02-22 08:32:48.435532	\N
18	3	2	direct_message	\N	\N	\N	2026-02-22 08:32:58.839605	\N
19	3	2	direct_message	\N	\N	\N	2026-02-22 08:33:08.200727	\N
\.


--
-- Data for Name: postcomments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.postcomments (post_id, comment_id, user_id) FROM stdin;
1	1	2
\.


--
-- Data for Name: postlikes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.postlikes (user_id, post_id) FROM stdin;
2	1
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.posts (id, content, media, project_id, creation_date, user_id, likes) FROM stdin;
1	Welcome to Devbits!\n>- To start - create your first `Stream`\n>- Then add a `Byte`!\n---\n>- *Any user can comment or chat with other users!*\n\n-- I hope you enjoy! :)	[]	1	2026-02-22 06:11:36.478826	2	2
\.


--
-- Data for Name: postsaves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.postsaves (user_id, post_id) FROM stdin;
2	1
\.


--
-- Data for Name: projectbuilders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projectbuilders (project_id, user_id) FROM stdin;
\.


--
-- Data for Name: projectcomments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projectcomments (project_id, comment_id, user_id) FROM stdin;
\.


--
-- Data for Name: projectfollows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projectfollows (user_id, project_id) FROM stdin;
2	1
2	2
\.


--
-- Data for Name: projectlikes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projectlikes (user_id, project_id) FROM stdin;
2	1
3	2
2	2
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, description, about_md, status, likes, links, tags, media, owner, creation_date) FROM stdin;
1	Devbits	`DevBits`\n___\n> An app for *Devs* and people with cool projects\n*Or if you are just taking a browse that is cool too*	![DevBits](https://github.com/devbits-go/.github/blob/main/profile/svg/DevBits.svg)\n\n![Purpose](https://github.com/devbits-go/.github/blob/main/profile/svg/Purpose.svg)\n\n> Welcome To *DevBits*, The App for Developers and people in tech.\n\n> Looking to create a healthy social environment for people to share their ideas.\n\n![Members](https://github.com/devbits-go/.github/blob/main/profile/svg/Members.svg)\n\n![Cards](https://github.com/devbits-go/.github/blob/main/profile/svg/Cards.svg)\n\n![ArchBTW](https://github.com/devbits-go/.github/blob/main/profile/svg/ArchBTW.svg)	0	2	["devbits.ddns.net/tester-application"]	["Devbits","New","App","Social Media","Testing"]	[]	2	2026-02-22 05:56:36.110313
2	Devbits.md	A place to show off MD support	# Markdown Syntax Guide\n\nA complete reference for Markdown formatting with interactive examples.\n\n---\n\n## Headers\n\n```\n# This is a Heading h1\n## This is a Heading h2\n### This is a Heading h3\n#### This is a Heading h4\n##### This is a Heading h5\n###### This is a Heading h6\n```\n\n# This is a Heading h1\n## This is a Heading h2\n### This is a Heading h3\n#### This is a Heading h4\n##### This is a Heading h5\n###### This is a Heading h6\n\n---\n\n## Emphasis\n\n*This text will be italic*  \n_This will also be italic_\n\n**This text will be bold**  \n__This will also be bold__\n\n_You **can** combine them_\n\n~~This text is strikethrough~~\n\n---\n\n## Lists\n\n### Unordered Lists\n\n* Item 1\n* Item 2\n* Item 2a\n* Item 2b\n    * Item 3a\n    * Item 3b\n\n### Ordered Lists\n\n1. Item 1\n2. Item 2\n3. Item 3\n    1. Item 3a\n    2. Item 3b\n\n### Task Lists (Checkboxes)\n\n- [x] Completed task\n- [x] Another completed task\n- [ ] Incomplete task\n- [ ] Another incomplete task\n    - [x] Subtask completed\n    - [ ] Subtask incomplete\n\n---\n\n## Images\n\n![This is an alt text.](/image/Markdown-mark.svg "This is a sample image.")\n\n---\n\n## Links\n\nYou may be using [Markdown Live Preview](https://markdownlivepreview.com/).\n\n[Link with title](https://example.com "This is a title")\n\n<https://example.com>\n\n---\n\n## Blockquotes\n\n> Markdown is a lightweight markup language with plain-text-formatting syntax, created in 2004 by John Gruber with Aaron Swartz.\n\n> Markdown is often used to format readme files, for writing messages in online discussion forums, and to create rich text using a plain text editor.\n\n> **Note:** You can use other markdown syntax within blockquotes.\n\n---\n\n## Tables\n\n| Left columns  | Center columns | Right columns |\n| ------------- |:-------------:|:-----------:|\n| left foo      | center foo     | right foo   |\n| left bar      | center bar     | right bar   |\n| left baz      | center baz     | right baz   |\n\n---\n\n## Code\n\n### Blocks of Code\n\n```javascript\nlet message = 'Hello world';\nalert(message);\n```\n\n```python\ndef hello_world():\n    print("Hello, World!")\n    return True\n```\n\n```html\n<div class="container">\n  <p>HTML Example</p>\n</div>\n```\n\n### Inline Code\n\nThis web site is using `markedjs/marked` for rendering markdown.\n\nUse the `console.log()` function to debug your code.\n\n---\n\n## Horizontal Rules\n\n---\n\n***\n\n___\n\n---\n\n## Line Breaks\n\nLine 1  \nLine 2 (with two spaces before)\n\nLine 1\n\nLine 2 (with blank line between)\n\n---\n\n<details>\n<summary><strong>≡ƒôÜ Advanced Features (Click to expand)</strong></summary>\n\n### Definition Lists\n\nTerm 1\n:   Definition 1\n\nTerm 2\n:   Definition 2a\n:   Definition 2b\n\n### Footnotes\n\nThis is a statement[^1] with a footnote.\n\n[^1]: This is the footnote content.\n\n### Superscript & Subscript\n\nH~2~O\n\nE=mc^2^\n\n</details>\n\n---\n\n<details>\n<summary><strong>Γ£à Markdown Best Practices (Click to expand)</strong></summary>\n\n- Use consistent heading hierarchy\n- Add blank lines between sections\n- Use code fences for better readability\n- Link to external resources when relevant\n- Keep lists simple and organized\n- Use emphasis sparingly for impact\n- Always provide alt text for images\n- Test your markdown before sharing\n\n</details>\n\n---\n\n<details>\n<summary><strong>≡ƒÄ¿ Tips & Tricks (Click to expand)</strong></summary>\n\n**Combining Styles:**\n- ***Bold and Italic*** combined\n- **Bold with `code`**\n- > Blockquote with **bold**\n\n**Escaping Characters:**\n\\*This will not be italic\\*\n\n\\[This is not a link\\]\n\n**HTML Embedding:**\nYou can embed raw HTML for more control over formatting.\n\n</details>\n\n---\n\n## Quick Reference Checklist\n\n- [x] Headers learned\n- [x] Emphasis mastered\n- [x] Lists understood\n- [x] Images added\n- [x] Links created\n- [x] Blockquotes used\n- [x] Tables created\n- [x] Code blocks formatted\n- [ ] Advanced features explored\n- [ ] Ready to write markdown!\n\n---\n\n**Last Updated:** February 20, 2026  \n**Format:** GitHub Flavored Markdown (GFM)	0	3	[]	[]	[]	2	2026-02-22 06:12:55.58306
\.


--
-- Data for Name: userfollows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.userfollows (follower_id, followed_id) FROM stdin;
2	3
\.


--
-- Data for Name: userlogininfo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.userlogininfo (username, password_hash) FROM stdin;
elifouts	$2a$10$eMXYEH8bfTiaam5F/fMKxeR/SM2P8GZCaB8IGeqUoleSqSLrHKjqa
Whiteshadow73	$2a$10$uMix6AqdN7p1BhvfzV0rS.k3cyUU1QumwUB1wvgxCx72xwhhxeF5O
\.


--
-- Data for Name: userpushtokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.userpushtokens (id, user_id, token, platform, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, picture, bio, links, settings, creation_date) FROM stdin;
2	elifouts	/uploads/u2_34db848e14529523fe699c2e.jpg	> [!Note] Hello World!\n\nI am a developer for `devbits`	{"link_0":"github.com/elifouts","link_1":"elifous.net","link_2":"elifouts.net/DNA"}	{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-22 05:28:00.259995
3	Whiteshadow73	/uploads/u3_8e213dd74950c62c9df55994.jpg		{}	{"accentColor":"#00F329","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":60000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-22 08:06:14.433232
\.


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.comments_id_seq', 1, true);


--
-- Name: directmessages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.directmessages_id_seq', 10, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 19, true);


--
-- Name: posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.posts_id_seq', 1, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 3, true);


--
-- Name: userpushtokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.userpushtokens_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: commentlikes commentlikes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentlikes
    ADD CONSTRAINT commentlikes_pkey PRIMARY KEY (user_id, comment_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: directmessages directmessages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directmessages
    ADD CONSTRAINT directmessages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: postcomments postcomments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postcomments
    ADD CONSTRAINT postcomments_pkey PRIMARY KEY (post_id, comment_id);


--
-- Name: postlikes postlikes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postlikes
    ADD CONSTRAINT postlikes_pkey PRIMARY KEY (user_id, post_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: postsaves postsaves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postsaves
    ADD CONSTRAINT postsaves_pkey PRIMARY KEY (user_id, post_id);


--
-- Name: projectbuilders projectbuilders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectbuilders
    ADD CONSTRAINT projectbuilders_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: projectcomments projectcomments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectcomments
    ADD CONSTRAINT projectcomments_pkey PRIMARY KEY (project_id, comment_id);


--
-- Name: projectfollows projectfollows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectfollows
    ADD CONSTRAINT projectfollows_pkey PRIMARY KEY (user_id, project_id);


--
-- Name: projectlikes projectlikes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectlikes
    ADD CONSTRAINT projectlikes_pkey PRIMARY KEY (user_id, project_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: userfollows userfollows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userfollows
    ADD CONSTRAINT userfollows_pkey PRIMARY KEY (follower_id, followed_id);


--
-- Name: userlogininfo userlogininfo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userlogininfo
    ADD CONSTRAINT userlogininfo_pkey PRIMARY KEY (username);


--
-- Name: userpushtokens userpushtokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userpushtokens
    ADD CONSTRAINT userpushtokens_pkey PRIMARY KEY (id);


--
-- Name: userpushtokens userpushtokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userpushtokens
    ADD CONSTRAINT userpushtokens_token_key UNIQUE (token);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_commentlikes_comment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commentlikes_comment_id ON public.commentlikes USING btree (comment_id);


--
-- Name: idx_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_user_id ON public.comments USING btree (user_id);


--
-- Name: idx_directmessages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_directmessages_created_at ON public.directmessages USING btree (creation_date DESC, id DESC);


--
-- Name: idx_directmessages_sender_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_directmessages_sender_recipient ON public.directmessages USING btree (sender_id, recipient_id);


--
-- Name: idx_notifications_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created_at ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_read_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_read_at ON public.notifications USING btree (user_id, read_at);


--
-- Name: idx_postlikes_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postlikes_post_id ON public.postlikes USING btree (post_id);


--
-- Name: idx_posts_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_project_id ON public.posts USING btree (project_id);


--
-- Name: idx_posts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_user_id ON public.posts USING btree (user_id);


--
-- Name: idx_projectfollows_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projectfollows_project_id ON public.projectfollows USING btree (project_id);


--
-- Name: idx_projectlikes_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projectlikes_project_id ON public.projectlikes USING btree (project_id);


--
-- Name: idx_projects_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_owner ON public.projects USING btree (owner);


--
-- Name: idx_userfollows_followed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userfollows_followed_id ON public.userfollows USING btree (followed_id);


--
-- Name: idx_userfollows_follower_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userfollows_follower_id ON public.userfollows USING btree (follower_id);


--
-- Name: idx_userpushtokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_userpushtokens_user_id ON public.userpushtokens USING btree (user_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: commentlikes commentlikes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentlikes
    ADD CONSTRAINT commentlikes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: commentlikes commentlikes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentlikes
    ADD CONSTRAINT commentlikes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: directmessages directmessages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directmessages
    ADD CONSTRAINT directmessages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: directmessages directmessages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directmessages
    ADD CONSTRAINT directmessages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: postcomments postcomments_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postcomments
    ADD CONSTRAINT postcomments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: postcomments postcomments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postcomments
    ADD CONSTRAINT postcomments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: postcomments postcomments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postcomments
    ADD CONSTRAINT postcomments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: postlikes postlikes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postlikes
    ADD CONSTRAINT postlikes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: postlikes postlikes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postlikes
    ADD CONSTRAINT postlikes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: postsaves postsaves_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postsaves
    ADD CONSTRAINT postsaves_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: postsaves postsaves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postsaves
    ADD CONSTRAINT postsaves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projectbuilders projectbuilders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectbuilders
    ADD CONSTRAINT projectbuilders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projectbuilders projectbuilders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectbuilders
    ADD CONSTRAINT projectbuilders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projectcomments projectcomments_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectcomments
    ADD CONSTRAINT projectcomments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: projectcomments projectcomments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectcomments
    ADD CONSTRAINT projectcomments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projectcomments projectcomments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectcomments
    ADD CONSTRAINT projectcomments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projectfollows projectfollows_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectfollows
    ADD CONSTRAINT projectfollows_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projectfollows projectfollows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectfollows
    ADD CONSTRAINT projectfollows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projectlikes projectlikes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectlikes
    ADD CONSTRAINT projectlikes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projectlikes projectlikes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projectlikes
    ADD CONSTRAINT projectlikes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_fkey FOREIGN KEY (owner) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userfollows userfollows_followed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userfollows
    ADD CONSTRAINT userfollows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userfollows userfollows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userfollows
    ADD CONSTRAINT userfollows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: userpushtokens userpushtokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userpushtokens
    ADD CONSTRAINT userpushtokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict T1gIORRn4dz2tTnBTfuw9svhAec0PIcflvz6xyc9wz5ffoFXFMG6fqwKjRdAydi

