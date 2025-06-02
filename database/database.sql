create table if not exists db_version (
    version_number integer not null
);

create table if not exists settings (
    id integer primary key,
    key text not null,
    value text not null,
    sensitive boolean not null default false
);

create table if not exists data_records (
    id integer primary key,
    data text not null
);

insert into db_version(version_number)
values(1);

insert into settings(key, value, sensitive)
values('service.url', 'https://www.plauzible.com', false);
