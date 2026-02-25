--
-- PostgreSQL database dump
--

\restrict Tr2faNB5SKBPU8RIjnVK7YQgM2f6sQAfCaGnj7qNGbX0K0S6QffBeixR2ydrKHa

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
2	\N	2	hey	[]	0	2026-02-24 06:02:43.563579
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
11	3	2	what do you want	2026-02-22 10:42:29.699899	\N
12	2	4	Hello did it work?	2026-02-22 23:45:51.541105	\N
13	2	7	hey	2026-02-24 03:22:44.030372	\N
14	2	7	what is up	2026-02-24 03:22:49.169012	\N
15	7	2	what the fuck	2026-02-24 03:22:50.547058	\N
16	7	2	you made a chat system	2026-02-24 03:22:56.130422	\N
17	7	2	you bastard	2026-02-24 03:23:00.33064	\N
18	2	7	yes	2026-02-24 03:23:15.673677	\N
19	2	7	im sorry	2026-02-24 03:23:21.155377	\N
20	7	2	wowowow	2026-02-24 03:23:22.010633	\N
21	7	2	crazy work	2026-02-24 03:23:31.057022	\N
22	2	7	why do notificstions still pop up	2026-02-24 03:23:36.229472	\N
23	7	2	ok tell me here rn	2026-02-24 03:23:37.876188	\N
24	7	2	how much of this is copilot	2026-02-24 03:23:44.505446	\N
25	7	2	i can report it lol	2026-02-24 03:23:52.206225	\N
26	2	7	i have never talked to someone before and 30% co pilot 20% comunity code and 50% staying up and being late to work	2026-02-24 03:24:17.708223	\N
27	2	7	why is chat actually working	2026-02-24 03:24:31.642664	\N
28	7	2	well its worth it	2026-02-24 03:24:32.431845	\N
29	7	2	you're crazyyyyy	2026-02-24 03:24:38.65296	\N
30	2	7	i have only done this with myself lol	2026-02-24 03:24:53.316298	\N
31	7	2	and ur crazy	2026-02-24 03:25:17.546545	\N
32	2	7	fav feature is theme changing btw	2026-02-24 03:25:28.805951	\N
33	2	7	check her out	2026-02-24 03:25:32.765308	\N
34	7	2	ok ok	2026-02-24 03:25:38.054775	\N
35	7	2	are these messages persisted	2026-02-24 03:25:45.046406	\N
36	2	7	also markdown. speant the longest on thsy	2026-02-24 03:25:55.731376	\N
37	2	7	and yes	2026-02-24 03:25:59.227035	\N
38	7	2	wowowow	2026-02-24 03:26:05.472512	\N
39	2	7	dont add a photo to a stream byte or comment. might crash app idk. it is touch and go	2026-02-24 03:27:10.431592	\N
40	7	2	lmao that can wait for later	2026-02-24 03:27:21.06114	\N
41	2	7	want me to blow your mind? im on the expo go app rn on iphone. i synced it up to the backend	2026-02-24 03:27:50.650943	\N
42	7	2	ur crazy	2026-02-24 03:27:59.257013	\N
43	7	2	insane	2026-02-24 03:28:03.330793	\N
44	2	7	shit is nice for testing	2026-02-24 03:28:09.658743	\N
45	7	2	btw i have no way to get to this chat (i think)? from the homepage	2026-02-24 03:28:17.691824	\N
46	2	7	home page, terminal, then type chat elifouts	2026-02-24 03:28:36.899297	\N
47	7	2	ah	2026-02-24 03:28:42.509447	\N
48	7	2	that is cool but semi-non-trivial	2026-02-24 03:28:56.757885	\N
49	2	7	i know	2026-02-24 03:29:06.20785	\N
50	7	2	also is the font huge for you or no lol	2026-02-24 03:29:19.410148	\N
51	2	7	i know may be too incinvenient. also notifications are like out of control	2026-02-24 03:29:45.167748	\N
52	7	2	lol	2026-02-24 03:29:54.158539	\N
53	7	2	test	2026-02-24 03:30:46.299876	\N
54	2	7	test	2026-02-24 03:30:57.988357	\N
55	7	2	weird, if i hit enter on my keyboard, it will not focus the box, but if i hit the key on the side here it does	2026-02-24 03:31:15.88166	\N
56	2	7	hmmm sorry i didnt design it for comp it kinda sucks.	2026-02-24 03:32:43.538126	\N
57	7	2	i added an issue, no biggie	2026-02-24 03:34:20.195667	\N
58	7	2	i also found that i was completely on the wrong page, i couldnt find the terminal button lol	2026-02-24 03:34:43.245808	\N
59	2	7	ahhh	2026-02-24 03:35:01.86916	\N
60	7	2	im gonna add issues, up to you if you care enough about them	2026-02-24 03:35:18.782106	\N
61	7	2	as the designer lol	2026-02-24 03:35:24.140855	\N
62	2	7	ill take a look at some point	2026-02-24 03:35:33.268409	\N
63	2	7	okk	2026-02-24 03:35:39.277043	\N
64	7	2	notifications are so boinked youre so right	2026-02-24 03:37:22.96889	\N
65	7	2	i keep seeing notification pins but there is nothing there lol	2026-02-24 03:37:38.970374	\N
66	7	2	known issue? or should i add one on github	2026-02-24 03:37:46.911071	\N
67	2	7	yeaa too many and page doesnt show then live	2026-02-24 03:37:49.443457	\N
68	2	7	add it	2026-02-24 03:37:58.516022	\N
69	7	2	hear	2026-02-24 03:38:02.933545	\N
70	7	2	heard*	2026-02-24 03:38:07.249757	\N
71	2	7	if you want you coukd also add uploads not working. other than profile pic	2026-02-24 03:38:26.578174	\N
72	7	2	yaya	2026-02-24 03:38:34.846156	\N
73	2	7	if you dont see the image in that one md test page is cause it isnt a real link. i just copy and pasted for the readme translate test site i found	2026-02-24 03:39:19.214642	\N
74	7	2	lol ok	2026-02-24 03:39:41.955142	\N
75	2	7	also if you type exit in this chat without / it still extis	2026-02-24 03:40:46.317609	\N
76	2	7	:(	2026-02-24 03:40:53.836938	\N
77	7	2	wdym what still exists	2026-02-24 03:41:02.880823	\N
78	7	2	also i dig the aurora theme :)	2026-02-24 03:41:11.905893	\N
79	2	7	exit and yea i made those presets from my favs i was playing around with	2026-02-24 03:41:50.63279	\N
80	7	2	oh ur saying that doesnt clear the messaes?	2026-02-24 03:42:27.342191	\N
81	7	2	messages?	2026-02-24 03:42:32.444241	\N
82	2	7	im saying you can just type "exit" and it will leave chat. i think you should have to type /exit to get back to term commands	2026-02-24 03:43:16.53486	\N
83	2	7	and i made it that way	2026-02-24 03:43:26.668807	\N
84	7	2	ohhhhhh	2026-02-24 03:43:57.055817	\N
85	2	7	but i dont i added an exeption	2026-02-24 03:43:59.455814	\N
86	2	7	think ^	2026-02-24 03:44:06.178758	\N
87	7	2	you did, just tested, will report	2026-02-24 03:44:23.488765	\N
88	2	7	go to settings > help and nav > md so see how im rendering markdown. i have a lot of issues with rendering md and	2026-02-24 03:45:50.29706	\N
89	2	7	yea	2026-02-24 03:45:53.566217	\N
90	7	2	ok will look	2026-02-24 03:46:05.113246	\N
91	7	2	i dont even see a help option in the settings lol	2026-02-24 03:49:12.87261	\N
92	7	2	nvmd im dumb	2026-02-24 03:49:49.296126	\N
93	7	2	see the md rendering has some issues but it looks very good overall	2026-02-24 03:51:32.829629	\N
94	7	2	i will add an issue though	2026-02-24 03:51:41.435514	\N
95	7	2	but dude seriously awesome job, i wouldnt have ever imagined it this good	2026-02-24 03:54:01.034306	\N
96	2	7	ur vision lol im just trying to carry it out :)	2026-02-24 04:55:40.792781	\N
97	2	5	Hello	2026-02-24 14:26:04.784453	\N
98	5	8	penis	2026-02-24 14:28:01.824466	\N
99	5	8	feedback	2026-02-24 14:28:10.055026	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, actor_id, type, post_id, project_id, comment_id, created_at, read_at) FROM stdin;
22	4	2	follow_user	\N	\N	\N	2026-02-22 23:37:12.499656	\N
23	4	2	direct_message	\N	\N	\N	2026-02-22 23:45:51.549256	\N
24	3	2	builder_added	\N	1	\N	2026-02-22 23:55:39.441395	\N
25	4	5	follow_user	\N	\N	\N	2026-02-23 14:05:31.617678	\N
26	3	5	follow_user	\N	\N	\N	2026-02-23 14:05:33.224218	\N
113	7	2	direct_message	\N	\N	\N	2026-02-24 04:55:40.797338	\N
114	5	2	direct_message	\N	\N	\N	2026-02-24 14:26:04.787561	\N
115	8	5	direct_message	\N	\N	\N	2026-02-24 14:28:01.829198	\N
116	8	5	direct_message	\N	\N	\N	2026-02-24 14:28:10.060184	\N
117	5	8	builder_added	\N	4	\N	2026-02-24 14:28:48.935545	\N
121	5	2	follow_user	\N	\N	\N	2026-02-24 14:59:38.597783	\N
122	8	2	follow_user	\N	\N	\N	2026-02-24 14:59:42.545036	\N
123	8	2	follow_user	\N	\N	\N	2026-02-24 16:42:09.933943	\N
124	8	2	follow_user	\N	\N	\N	2026-02-24 16:42:14.999132	\N
125	8	2	follow_user	\N	\N	\N	2026-02-24 16:42:17.831356	\N
126	8	2	follow_user	\N	\N	\N	2026-02-24 16:42:20.600543	\N
127	3	2	follow_user	\N	\N	\N	2026-02-24 16:42:23.646586	\N
128	9	2	follow_user	\N	\N	\N	2026-02-24 18:59:50.771187	\N
129	8	2	save_project	\N	4	\N	2026-02-24 19:35:04.821892	\N
\.


--
-- Data for Name: postcomments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.postcomments (post_id, comment_id, user_id) FROM stdin;
1	1	2
1	2	2
\.


--
-- Data for Name: postlikes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.postlikes (user_id, post_id) FROM stdin;
2	1
2	3
2	2
\.


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.posts (id, content, media, project_id, creation_date, user_id, likes) FROM stdin;
1	Welcome to Devbits!\n>- To start - create your first `Stream`\n>- Then add a `Byte`!\n---\n>- *Any user can comment or chat with other users!*\n\n-- I hope you enjoy! :)	[]	1	2026-02-22 06:11:36.478826	2	2
3	Go to `settings > Help` for documentation on site MD rendering 	[]	2	2026-02-22 23:54:39.762739	2	1
2	> [!Tip] Set up your Bio!!	[]	1	2026-02-22 23:51:46.051741	2	1
\.


--
-- Data for Name: postsaves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.postsaves (user_id, post_id) FROM stdin;
\.


--
-- Data for Name: projectbuilders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projectbuilders (project_id, user_id) FROM stdin;
1	3
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
7	1
2	4
\.


--
-- Data for Name: projectlikes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projectlikes (user_id, project_id) FROM stdin;
7	2
7	1
2	2
2	1
8	4
2	6
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, description, about_md, status, likes, links, tags, media, owner, creation_date) FROM stdin;
2	Devbits.md	A place to show off MD support	# Markdown Syntax Guide\n\nA complete reference for Markdown formatting with interactive examples.\n\n---\n\n## Headers\n\n```\n# This is a Heading h1\n## This is a Heading h2\n### This is a Heading h3\n#### This is a Heading h4\n##### This is a Heading h5\n###### This is a Heading h6\n```\n\n# This is a Heading h1\n## This is a Heading h2\n### This is a Heading h3\n#### This is a Heading h4\n##### This is a Heading h5\n###### This is a Heading h6\n\n---\n\n## Emphasis\n\n*This text will be italic*  \n_This will also be italic_\n\n**This text will be bold**  \n__This will also be bold__\n\n_You **can** combine them_\n\n~~This text is strikethrough~~\n\n---\n\n## Lists\n\n### Unordered Lists\n\n* Item 1\n* Item 2\n* Item 2a\n* Item 2b\n    * Item 3a\n    * Item 3b\n\n### Ordered Lists\n\n1. Item 1\n2. Item 2\n3. Item 3\n    1. Item 3a\n    2. Item 3b\n\n### Task Lists (Checkboxes)\n\n- [x] Completed task\n- [x] Another completed task\n- [ ] Incomplete task\n- [ ] Another incomplete task\n    - [x] Subtask completed\n    - [ ] Subtask incomplete\n\n---\n\n## Images\n\n![This is an alt text.](/image/Markdown-mark.svg "This is a sample image.")\n\n---\n\n## Links\n\nYou may be using [Markdown Live Preview](https://markdownlivepreview.com/).\n\n[Link with title](https://example.com "This is a title")\n\n<https://example.com>\n\n---\n\n## Blockquotes\n\n> Markdown is a lightweight markup language with plain-text-formatting syntax, created in 2004 by John Gruber with Aaron Swartz.\n\n> Markdown is often used to format readme files, for writing messages in online discussion forums, and to create rich text using a plain text editor.\n\n> **Note:** You can use other markdown syntax within blockquotes.\n\n---\n\n## Tables\n\n| Left columns  | Center columns | Right columns |\n| ------------- |:-------------:|:-----------:|\n| left foo      | center foo     | right foo   |\n| left bar      | center bar     | right bar   |\n| left baz      | center baz     | right baz   |\n\n---\n\n## Code\n\n### Blocks of Code\n\n```javascript\nlet message = 'Hello world';\nalert(message);\n```\n\n```python\ndef hello_world():\n    print("Hello, World!")\n    return True\n```\n\n```html\n<div class="container">\n  <p>HTML Example</p>\n</div>\n```\n\n### Inline Code\n\nThis web site is using `markedjs/marked` for rendering markdown.\n\nUse the `console.log()` function to debug your code.\n\n---\n\n## Horizontal Rules\n\n---\n\n***\n\n___\n\n---\n\n## Line Breaks\n\nLine 1  \nLine 2 (with two spaces before)\n\nLine 1\n\nLine 2 (with blank line between)\n\n---\n\n<details>\n<summary><strong>???? Advanced Features (Click to expand)</strong></summary>\n\n### Definition Lists\n\nTerm 1\n:   Definition 1\n\nTerm 2\n:   Definition 2a\n:   Definition 2b\n\n### Footnotes\n\nThis is a statement[^1] with a footnote.\n\n[^1]: This is the footnote content.\n\n### Superscript & Subscript\n\nH~2~O\n\nE=mc^2^\n\n</details>\n\n---\n\n<details>\n<summary><strong>??? Markdown Best Practices (Click to expand)</strong></summary>\n\n- Use consistent heading hierarchy\n- Add blank lines between sections\n- Use code fences for better readability\n- Link to external resources when relevant\n- Keep lists simple and organized\n- Use emphasis sparingly for impact\n- Always provide alt text for images\n- Test your markdown before sharing\n\n</details>\n\n---\n\n<details>\n<summary><strong>???? Tips & Tricks (Click to expand)</strong></summary>\n\n**Combining Styles:**\n- ***Bold and Italic*** combined\n- **Bold with `code`**\n- > Blockquote with **bold**\n\n**Escaping Characters:**\n\\*This will not be italic\\*\n\n\\[This is not a link\\]\n\n**HTML Embedding:**\nYou can embed raw HTML for more control over formatting.\n\n</details>\n\n---\n\n## Quick Reference Checklist\n\n- [x] Headers learned\n- [x] Emphasis mastered\n- [x] Lists understood\n- [x] Images added\n- [x] Links created\n- [x] Blockquotes used\n- [x] Tables created\n- [x] Code blocks formatted\n- [ ] Advanced features explored\n- [ ] Ready to write markdown!\n\n---\n\n**Last Updated:** February 20, 2026  \n**Format:** GitHub Flavored Markdown (GFM)	0	3	[]	["markdown","documentation","devbits"]	[]	2	2026-02-22 06:12:55.58306
1	Devbits	`DevBits`\n___\n> An app for *Devs* and people with cool projects\n*Or if you are just taking a browse that is cool too*	![DevBits](https://github.com/devbits-go/.github/blob/main/profile/svg/DevBits.svg)\n\n![Purpose](https://github.com/devbits-go/.github/blob/main/profile/svg/Purpose.svg)\n\n> Welcome To *DevBits*, The App for Developers and people in tech.\n\n> Looking to create a healthy social environment for people to share their ideas.\n\n![Members](https://github.com/devbits-go/.github/blob/main/profile/svg/Members.svg)\n\n![Cards](https://github.com/devbits-go/.github/blob/main/profile/svg/Cards.svg)\n\n![ArchBTW](https://github.com/devbits-go/.github/blob/main/profile/svg/ArchBTW.svg)	0	3	["devbits.ddns.net/tester-application"]	["Devbits","New","App","Social Media","Testing","documentation"]	[]	2	2026-02-22 05:56:36.110313
4	Ball growing machine	machine that grows my balls	Currently it does not grow my balls. Further testing required	0	1	[]	["Balls","grow","big"]	[]	8	2026-02-24 14:27:57.974905
6	i found issue	Issue	when i try to add link to my profile my keyboard covers the box and i cannot see what i typing to thpost i cant see what im typing on this as well keyboard covers it also caps are being weird my image wont upload and after i post it being glitchy	0	1	[]	[]	["https://devbits.ddns.net/uploads/u9_912c35d6bb863bcf54d1b5c7.png"]	9	2026-02-24 17:50:48.488426
\.


--
-- Data for Name: userfollows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.userfollows (follower_id, followed_id) FROM stdin;
2	4
5	4
2	7
7	2
2	5
2	8
2	3
2	9
\.


--
-- Data for Name: userlogininfo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.userlogininfo (username, password_hash) FROM stdin;
elifouts	$2a$10$eMXYEH8bfTiaam5F/fMKxeR/SM2P8GZCaB8IGeqUoleSqSLrHKjqa
Whiteshadow73	$2a$10$uMix6AqdN7p1BhvfzV0rS.k3cyUU1QumwUB1wvgxCx72xwhhxeF5O
drtimfouts	$2a$10$EwIsRelUKZkFYvHxK.ZYYu4ib4KtaCsSlfn5BoYa7tzhS2h.lsgkW
bonerbob	$2a$10$XN1FnCZSWkXpASpFbNc7/eqn88x2.MPziOfOqZBw5m9ZmaVhAD5D2
DerekCornDev	$2a$10$RSpHVp.8.htmbvLfhPd3P.cEetp9dMeUbjhlrzlNJAfHw34vfExZ2
Reginald	$2a$10$EEWsKL8waqCTNHvHdpBgDuF.eEBBuBafPZGkE5dCXbgjh2bne0QYm
kylie	$2a$10$9qt8DwUNFH64REPD7/IJ1uL8I.28WCQArmnwn8I.DfFaXW7J/RZOC
\.


--
-- Data for Name: userpushtokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.userpushtokens (id, user_id, token, platform, created_at) FROM stdin;
1	2	ExponentPushToken[0swYQCMnwgv2U7vm3X51pW]	ios	2026-02-24 05:34:44.586288
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, picture, bio, links, settings, creation_date) FROM stdin;
3	Whiteshadow73	/uploads/u3_8e213dd74950c62c9df55994.jpg		{}	{"accentColor":"#3DACFD","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":60000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-22 08:06:14.433232
4	drtimfouts	/uploads/bfbe036460f2602afb275915.htm	Dev dad	{}	{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-22 19:11:39.453595
7	DerekCornDev			{}	{"accentColor":"#4A8DFF","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-24 03:19:40.762558
9	kylie	/uploads/u9_c1724846b8f93da55f421234.jpg	Hi	{"link_0":"Kylie-Merz"}	{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-24 17:46:13.221158
2	elifouts	/uploads/u2_31ec6c089f9f008d2b4b2c52.jpg	> [!Note] Hello World!\n\nI am a developer for `devbits`	{"link_0":"github.com/elifouts","link_1":"elifous.net","link_2":"elifouts.net/DNA"}	{"accentColor":"#00F329","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-22 05:28:00.259995
8	Reginald			{}	{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-24 14:25:18.538131
5	bonerbob	/uploads/u5_d8d0b793924c9834ebcabf88.jpg		{}	{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"hasSeenWelcomeTour":true,"imageRevealEffect":"smooth","linkOpenMode":"asTyped","pageTransitionEffect":"fade","refreshIntervalMs":120000,"rgbShiftEnabled":false,"rgbShiftSpeedMs":3200,"rgbShiftStep":0.85,"rgbShiftTheme":"rainbow","rgbShiftTickMs":44,"rgbUserTheme1":["#00F329","#06B6D4","#A855F7"],"rgbUserTheme2":["#FF6B6B","#F59E0B","#FDE047"],"textRenderEffect":"smooth","visualizationIntensity":0.55,"visualizationMode":"monoAccent","zenMode":false}	2026-02-23 14:05:00.130288
\.


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.comments_id_seq', 2, true);


--
-- Name: directmessages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.directmessages_id_seq', 99, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 129, true);


--
-- Name: posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.posts_id_seq', 4, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 6, true);


--
-- Name: userpushtokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.userpushtokens_id_seq', 31, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


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

\unrestrict Tr2faNB5SKBPU8RIjnVK7YQgM2f6sQAfCaGnj7qNGbX0K0S6QffBeixR2ydrKHa

