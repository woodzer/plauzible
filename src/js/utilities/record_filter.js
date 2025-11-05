export default class RecordFilter {
    constructor(nameFilter="", tagFilter=[]) {
        this.nameFilter = nameFilter;
        this.tagFilter = tagFilter;
    }

    hasAnyOfTagList(record, tagList) {
        let result = false;

        if(tagList.length > 0) {
            result = record.tags.some((t) => tagList.includes(t));
        }

        return(result);
    }

    hasNoTags(record) {
        return(!record.tags || record.tags.length === 0);
    }

    hasTag(record, tag) {
        let result = false;

        if(record.tags && record.tags.length > 0) {
            result = record.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
        }

        return(result);
    }

    matchesOnName(record) {
        return(this.nameFilter === "" || record.name.toLowerCase().includes(this.nameFilter.toLowerCase()));
    }

    matchesOnTags(record) {
        return(this.tagFilter.length === 0 || this.hasAnyOfTagList(record, this.tagFilter));
    }

    matches(record) {
        return(this.matchesOnName(record) && this.matchesOnTags(record));
    }
}