/**
 * vCardJS - a vCard 4.0 implementation in JavaScript
 *
 * (c) 2012 - Niklas Cathor
 *
 * Latest source: https://github.com/nilclass/vcardjs
 **/

define('vcardjs', function() {
/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
(function() {
  // Private array of chars to use
  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

  Math.uuid = function (len, radix) {
    var chars = CHARS, uuid = [], i;
    radix = radix || chars.length;

    if (len) {
      // Compact form
      for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
    } else {
      // rfc4122, version 4 form
      var r;

      // rfc4122 requires these characters
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';

      // Fill in random data.  At i==19 set the high bits of clock sequence as
      // per rfc4122, sec. 4.1.5
      for (i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | Math.random()*16;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
    }

    return uuid.join('');
  };

  // A more performant, but slightly bulkier, RFC4122v4 solution.  We boost performance
  // by minimizing calls to random()
  Math.uuidFast = function() {
    var chars = CHARS, uuid = new Array(36), rnd=0, r;
    for (var i = 0; i < 36; i++) {
      if (i==8 || i==13 ||  i==18 || i==23) {
        uuid[i] = '-';
      } else if (i==14) {
        uuid[i] = '4';
      } else {
        if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
        r = rnd & 0xf;
        rnd = rnd >> 4;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
    return uuid.join('');
  };

  // A more compact, but less performant, RFC4122v4 solution:
  Math.uuidCompact = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  };
})();

// exported globals
var VCard;

(function() {

    VCard = function(attributes) {
	      this.changed = false;
        if(typeof(attributes) === 'object') {
            for(var key in attributes) {
                this[key] = attributes[key];
	              this.changed = true;
            }
        }
    };

    VCard.prototype = {

	      // Check validity of this VCard instance. Properties that can be generated,
	      // will be generated. If any error is found, false is returned and vcard.errors
	      // set to an Array of [attribute, errorType] arrays.
	      // Otherwise true is returned.
	      //
	      // In case of multivalued properties, the "attribute" part of the error is
	      // the attribute name, plus it's index (starting at 0). Example: email0, tel7, ...
	      //
	      // It is recommended to call this method even if this VCard object was imported,
	      // as some software (e.g. Gmail) doesn't generate UIDs.
	      validate: function() {
	          var errors = [];

	          function addError(attribute, type) {
		            errors.push([attribute, type]);
	          }

	          if(! this.fn) { // FN is a required attribute
		            addError("fn", "required");
	          }

	          // make sure multivalued properties are *always* in array form
	          for(var key in VCard.multivaluedKeys) {
		            if(this[key] && ! (this[key] instanceof Array)) {
                    this[key] = [this[key]];
		            }
	          }

	          // make sure compound fields have their type & value set
	          // (to prevent mistakes such as vcard.addAttribute('email', 'foo@bar.baz')
	          function validateCompoundWithType(attribute, values) {
		            for(var i in values) {
		                var value = values[i];
		                if(typeof(value) !== 'object') {
			                  errors.push([attribute + '-' + i, "not-an-object"]);
		                } else if(! value.type) {
			                  errors.push([attribute + '-' + i, "missing-type"]);
		                } else if(! value.value) { // empty values are not allowed.
			                  errors.push([attribute + '-' + i, "missing-value"]);
		                }
		            }
	          }

	          if(this.email) {
		            validateCompoundWithType('email', this.email);
	          }

	          if(this.tel) {
		            validateCompoundWithType('email', this.tel);
	          }

	          if(! this.uid) {
		            this.addAttribute('uid', this.generateUID());
	          }

	          if(! this.rev) {
		            this.addAttribute('rev', this.generateRev());
	          }

	          this.errors = errors;

	          return ! (errors.length > 0);
	      },

	      // generate a UID. This generates a UUID with uuid: URN namespace, as suggested
	      // by RFC 6350, 6.7.6
	      generateUID: function() {
	          return 'uuid:' + Math.uuid();
	      },

	      // generate revision timestamp (a full ISO 8601 date/time string in basic format)
	      generateRev: function() {
	          return (new Date()).toISOString().replace(/[\.\:\-]/g, '');
	      },

	      // Set the given attribute to the given value.
	      // This sets vcard.changed to true, so you can check later whether anything
	      // was updated by your code.
        setAttribute: function(key, value) {
            this[key] = value;
	          this.changed = true;
        },

	      // Set the given attribute to the given value.
	      // If the given attribute's key has cardinality > 1, instead of overwriting
	      // the current value, an additional value is appended.
        addAttribute: function(key, value) {
            console.log('add attribute', key, value);
            if(! value) {
                return;
            }
            if(VCard.multivaluedKeys[key]) {
                if(this[key]) {
                    console.log('multivalued push');
                    this[key].push(value)
                } else {
                    console.log('multivalued set');
                    this.setAttribute(key, [value]);
                }
            } else {
                this.setAttribute(key, value);
            }
        },

	      // convenience method to get a JSON serialized jCard.
	      toJSON: function() {
	          return JSON.stringify(this.toJCard());
	      },

	      // Copies all properties (i.e. all specified in VCard.allKeys) to a new object
	      // and returns it.
	      // Useful to serialize to JSON afterwards.
        toJCard: function() {
            var jcard = {};
            for(var k in VCard.allKeys) {
                var key = VCard.allKeys[k];
                if(this[key]) {
                    jcard[key] = this[key];
                }
            }
            return jcard;
        },

        // synchronizes two vcards, using the mechanisms described in
        // RFC 6350, Section 7.
        // Returns a new VCard object.
        // If a property is present in both source vcards, and that property's
        // maximum cardinality is 1, then the value from the second (given) vcard
        // precedes.
        //
        // TODO: implement PID matching as described in 7.3.1
        merge: function(other) {
            if(typeof(other.uid) !== 'undefined' &&
               typeof(this.uid) !== 'undefined' &&
               other.uid !== this.uid) {
                // 7.1.1
                throw "Won't merge vcards without matching UIDs.";
            }

            var result = new VCard();

            function mergeProperty(key) {
                if(other[key]) {
                    if(other[key] == this[key]) {
                        result.setAttribute(this[key]);
                    } else {
                        result.addAttribute(this[key]);
                        result.addAttribute(other[key]);
                    }
                } else {
                    result[key] = this[key];
                }
            }

            for(key in this) { // all properties of this
                mergeProperty(key);
            }
            for(key in other) { // all properties of other *not* in this
                if(! result[key]) {
                    mergeProperty(key);
                }
            }
        }
    };

    VCard.enums = {
        telType: ["text", "voice", "fax", "cell", "video", "pager", "textphone"],
        relatedType: ["contact", "acquaintance", "friend", "met", "co-worker",
                      "colleague", "co-resident", "neighbor", "child", "parent",
                      "sibling", "spouse", "kin", "muse", "crush", "date",
                      "sweetheart", "me", "agent", "emergency"],
        // FIXME: these aren't actually defined anywhere. just very commmon.
        //        maybe there should be more?
        emailType: ["work", "home", "internet"],
        langType: ["work", "home"],
        
    };

    VCard.allKeys = [
        'fn', 'n', 'nickname', 'photo', 'bday', 'anniversary', 'gender',
        'tel', 'email', 'impp', 'lang', 'tz', 'geo', 'title', 'role', 'logo',
        'org', 'member', 'related', 'categories', 'note', 'prodid', 'rev',
        'sound', 'uid'
    ];

    VCard.multivaluedKeys = {
        email: true,
        tel: true,
        geo: true,
        title: true,
        role: true,
        logo: true,
        org: true,
        member: true,
        related: true,
        categories: true,
        note: true
    };

})();
/**
 ** VCF - Parser for the vcard format.
 **
 ** This is purely a vCard 4.0 implementation, as described in RFC 6350.
 **
 ** The generated VCard object roughly corresponds to the JSON representation
 ** of a hCard, as described here: http://microformats.org/wiki/jcard
 ** (Retrieved May 17, 2012)
 **
 **/

var VCF;

(function() {
    VCF = {

        simpleKeys: [
            'VERSION',
            'FN', // 6.2.1
            'PHOTO', // 6.2.4 (we don't care about URIs [yet])
            'GEO', // 6.5.2 (SHOULD also b a URI)
            'TITLE', // 6.6.1
            'ROLE', // 6.6.2
            'LOGO', // 6.6.3 (also [possibly data:] URI)
            'MEMBER', // 6.6.5
            'NOTE', // 6.7.2
            'PRODID', // 6.7.3
            'SOUND', // 6.7.5
            'UID', // 6.7.6
        ],
        csvKeys: [
            'NICKNAME', // 6.2.3
            'CATEGORIES', // 6.7.1
        ],
        dateAndOrTimeKeys: [
            'BDAY',        // 6.2.5
            'ANNIVERSARY', // 6.2.6
            'REV', // 6.7.4
        ],

        // parses the given input, constructing VCard objects.
        // if the input contains multiple (properly seperated) vcards,
        // the callback may be called multiple times, with one vcard given
        // each time.
        // The third argument specifies the context in which to evaluate
        // the given callback.
        parse: function(input, callback, context) {
            var vcard = null;

            if(! context) {
                context = this;
            }

            this.lex(input, function(key, value, attrs) {
                function setAttr(val) {
                    if(vcard) {
                        vcard.addAttribute(key.toLowerCase(), val);
                    }
                }
                if(key == 'BEGIN') {
                    vcard = new VCard();
                } else if(key == 'END') {
                    if(vcard) {
                        callback.apply(context, [vcard]);
                        vcard = null;
                    }

                } else if(this.simpleKeys.indexOf(key) != -1) {
                    setAttr(value);

                } else if(this.csvKeys.indexOf(key) != -1) {
                    setAttr(value.split(','));

                } else if(this.dateAndOrTimeKeys.indexOf(key) != -1) {
                    if(attrs.VALUE == 'text') {
                        // times can be expressed as "text" as well,
                        // e.g. "ca 1800", "next week", ...
                        setAttr(value);
                    } else if(attrs.CALSCALE && attrs.CALSCALE != 'gregorian') {
                        // gregorian calendar is the only calscale mentioned
                        // in RFC 6350. I do not intend to support anything else
                        // (yet).
                    } else {
                        // FIXME: handle TZ attribute.
                        setAttr(this.parseDateAndOrTime(value));
                    }

                } else if(key == 'N') { // 6.2.2
                    setAttr(this.parseName(value));

                } else if(key == 'GENDER') { // 6.2.7
                    setAttr(this.parseGender(value));

                } else if(key == 'TEL') { // 6.4.1
                    setAttr({
                        type: (attrs.TYPE || 'voice'),
                        pref: attrs.PREF,
                        value: value
                    });

                } else if(key == 'EMAIL') { // 6.4.2
                    setAttr({
                        type: attrs.TYPE,
                        pref: attrs.PREF,
                        value: value
                    });

                } else if(key == 'IMPP') { // 6.4.3
                    // RFC 6350 doesn't define TYPEs for IMPP addresses.
                    // It just seems odd to me to have multiple email addresses and phone numbers,
                    // but not multiple IMPP addresses.
                    setAttr({ value: value });

                } else if(key == 'LANG') { // 6.4.4
                    setAttr({
                        type: attrs.TYPE,
                        pref: attrs.PREF,
                        value: value
                    });

                } else if(key == 'TZ') { // 6.5.1
                    // neither hCard nor jCard mention anything about the TZ
                    // property, except that it's singular (which it is *not* in
                    // RFC 6350).
                    // using compound representation.
                    if(attrs.VALUE == 'utc-offset') {
                        setAttr({ 'utc-offset': this.parseTimezone(value) });
                    } else {
                        setAttr({ name: value });
                    }

                } else if(key == 'ORG') { // 6.6.4
                    var parts = value.split(';');
                    setAttr({
                        'organization-name': parts[0],
                        'organization-unit': parts[1]
                    });

                } else if(key == 'RELATED') { // 6.6.6
                    setAttr({
                        type: attrs.TYPE,
                        pref: attrs.PREF,
                        value: attrs.VALUE
                    });

                } else if(key =='ADR'){
                    setAttr({
                        type: attrs.TYPE,
                        pref: attrs.PREF,
                        value: value
                    });
                    //TODO: Handle 'LABEL' field.
                } else {
                    console.log('WARNING: unhandled key: ', key);
                }
            });
        },
        
        nameParts: [
            'family-name', 'given-name', 'additional-name',
            'honorific-prefix', 'honorific-suffix'
        ],

        parseName: function(name) { // 6.2.2
            var parts = name.split(';');
            var n = {};
            for(var i in parts) {
                if(parts[i]) {
                    n[this.nameParts[i]] = parts[i].split(',');
                }
            }
            return n;
        },

        /**
         * The representation of gender for hCards (and hence their JSON
         * representation) is undefined, as hCard is based on RFC 2436, which
         * doesn't define the GENDER attribute.
         * This method uses a compound representation.
         *
         * Examples:
         *   "GENDER:M"              -> {"sex":"male"}
         *   "GENDER:M;man"          -> {"sex":"male","identity":"man"}
         *   "GENDER:F;girl"         -> {"sex":"female","identity":"girl"}
         *   "GENDER:M;girl"         -> {"sex":"male","identity":"girl"}
         *   "GENDER:F;boy"          -> {"sex":"female","identity":"boy"}
         *   "GENDER:N;woman"        -> {"identity":"woman"}
         *   "GENDER:O;potted plant" -> {"sex":"other","identity":"potted plant"}
         */
        parseGender: function(value) { // 6.2.7
            var gender = {};
            var parts = value.split(';');
            switch(parts[0]) {
            case 'M':
                gender.sex = 'male';
                break;
            case 'F':
                gender.sex = 'female';
                break;
            case 'O':
                gender.sex = 'other';
            }
            if(parts[1]) {
                gender.identity = parts[1];
            }
            return gender;
        },

        /** Date/Time parser.
         * 
         * This implements only the parts of ISO 8601, that are
         * allowed by RFC 6350.
         * Paranthesized examples all represent (parts of):
         *   31st of January 1970, 23 Hours, 59 Minutes, 30 Seconds
         **/

        /** DATE **/

        // [ISO.8601.2004], 4.1.2.2, basic format:
        dateRE: /^(\d{4})(\d{2})(\d{2})$/, // (19700131)

        // [ISO.8601.2004], 4.1.2.3 a), basic format:
        dateReducedARE: /^(\d{4})\-(\d{2})$/, // (1970-01)

        // [ISO.8601.2004], 4.1.2.3 b), basic format:
        dateReducedBRE: /^(\d{4})$/, // (1970)

        // truncated representation from [ISO.8601.2000], 5.3.1.4.
        // I don't have access to that document, so relying on examples
        // from RFC 6350:
        dateTruncatedMDRE: /^\-{2}(\d{2})(\d{2})$/, // (--0131)
        dateTruncatedDRE: /^\-{3}(\d{2})$/, // (---31)

        /** TIME **/

        // (Note: it is unclear to me which of these are supposed to support
        //        timezones. Allowing them for all. If timezones are ommitted,
        //        defaulting to UTC)

        // [ISO.8601.2004, 4.2.2.2, basic format:
        timeRE: /^(\d{2})(\d{2})(\d{2})([+\-]\d+|Z|)$/, // (235930)
        // [ISO.8601.2004, 4.2.2.3 a), basic format:
        timeReducedARE: /^(\d{2})(\d{2})([+\-]\d+|Z|)$/, // (2359)
        // [ISO.8601.2004, 4.2.2.3 b), basic format:
        timeReducedBRE: /^(\d{2})([+\-]\d+|Z|)$/, // (23)
        // truncated representation from [ISO.8601.2000], see above.
        timeTruncatedMSRE: /^\-{2}(\d{2})(\d{2})([+\-]\d+|Z|)$/, // (--5930)
        timeTruncatedSRE: /^\-{3}(\d{2})([+\-]\d+|Z|)$/, // (---30)

        parseDate: function(data) {
            var md;
            var y, m, d;
            if((md = data.match(this.dateRE))) {
                y = md[1]; m = md[2]; d = md[3];
            } else if((md = data.match(this.dateReducedARE))) {
                y = md[1]; m = md[2];
            } else if((md = data.match(this.dateReducedBRE))) {
                y = md[1];
            } else if((md = data.match(this.dateTruncatedMDRE))) {
                m = md[1]; d = md[2];
            } else if((md = data.match(this.dateTruncatedDRE))) {
                d = md[1];
            } else {
                console.error("WARNING: failed to parse date: ", data);
                return null;
            }
            var dt = new Date(0);
            if(typeof(y) != 'undefined') { dt.setUTCFullYear(y); }
            if(typeof(m) != 'undefined') { dt.setUTCMonth(m - 1); }
            if(typeof(d) != 'undefined') { dt.setUTCDate(d); }
            return dt;
        },

        parseTime: function(data) {
            var md;
            var h, m, s, tz;
            if((md = data.match(this.timeRE))) {
                h = md[1]; m = md[2]; s = md[3];
                tz = md[4];
            } else if((md = data.match(this.timeReducedARE))) {
                h = md[1]; m = md[2];
                tz = md[3];
            } else if((md = data.match(this.timeReducedBRE))) {
                h = md[1];
                tz = md[2];
            } else if((md = data.match(this.timeTruncatedMSRE))) {
                m = md[1]; s = md[2];
                tz = md[3];
            } else if((md = data.match(this.timeTruncatedSRE))) {
                s = md[1];
                tz = md[2];
            } else {
                console.error("WARNING: failed to parse time: ", data);
                return null;
            }

            var dt = new Date(0);
            if(typeof(h) != 'undefined') { dt.setUTCHours(h); }
            if(typeof(m) != 'undefined') { dt.setUTCMinutes(m); }           
            if(typeof(s) != 'undefined') { dt.setUTCSeconds(s); }

            if(tz) {
                dt = this.applyTimezone(dt, tz);
            }

            return dt;
        },

        // add two dates. if addSub is false, substract instead of add.
        addDates: function(aDate, bDate, addSub) {
            if(typeof(addSub) == 'undefined') { addSub = true };
            if(! aDate) { return bDate; }
            if(! bDate) { return aDate; }
            var a = Number(aDate);
            var b = Number(bDate);
            var c = addSub ? a + b : a - b;
            return new Date(c);
        },

        parseTimezone: function(tz) {
            var md;
            if((md = tz.match(/^([+\-])(\d{2})(\d{2})?/))) {
                var offset = new Date(0);
                offset.setUTCHours(md[2]);
                offset.setUTCMinutes(md[3] || 0);
                return Number(offset) * (md[1] == '+' ? +1 : -1);
            } else {
                return null;
            }
        },

        applyTimezone: function(date, tz) {
            var offset = this.parseTimezone(tz);
            if(offset) {
                return new Date(Number(date) + offset);
            } else {
                return date;
            }
        },

        parseDateTime: function(data) {
            var parts = data.split('T');
            var t = this.parseDate(parts[0]);
            var d = this.parseTime(parts[1]);
            return this.addDates(t, d);
        },

        parseDateAndOrTime: function(data) {
            switch(data.indexOf('T')) {
            case 0:
                return this.parseTime(data.slice(1));
            case -1:
                return this.parseDate(data);
            default:
                return this.parseDateTime(data);
            }
        },

        lineRE: /^([^\s].*)(?:\r?\n|$)/, // spec wants CRLF, but we're on the internet. reality is chaos.
        foldedLineRE:/^\s(.+)(?:\r?\n|$)/,

        // lex the given input, calling the callback for each line, with
        // the following arguments:
        //   * key - key of the statement, such as 'BEGIN', 'FN', 'N', ...
        //   * value - value of the statement, i.e. everything after the first ':'
        //   * attrs - object containing attributes, such as {"TYPE":"work"}
        lex: function(input, callback) {

            var md, line = null, length = 0;

            for(;;) {
                if((md = input.match(this.lineRE))) {
                    // Unfold quoted-printables (vCard 2.1) into a single line before parsing.
                    // "Soft" linebreaks are indicated by a '=' at the end of the line, and do
                    // not affect the underlying data.
                    if(line && line.indexOf('QUOTED-PRINTABLE') != -1 && line.slice(-1) == '=') {
                        line = line.slice(0,-1) + md[1];
                        length = md[0].length;
                    } else {
                        if(line) {
                            this.lexLine(line, callback);   
                        }
                        line = md[1];
                        length = md[0].length;
                    }
                } else if((md = input.match(this.foldedLineRE))) {
                    if(line) {
                        line += md[1];
                        length = md[0].length;
                    } else {
                        // ignore folded junk.
                    }
                } else {
                    console.error("Unmatched line: " + line);
                }

                input = input.slice(length);

                if(! input) {
                    break;
                }
            }

            if(line) {
                // last line.
                this.lexLine(line, callback);
            }

            line = null;
        },

        lexLine: function(line, callback) {
            var tmp = '';
            var key = null, attrs = {}, value = null, attrKey = null;

            //If our value is a quoted-printable (vCard 2.1), decode it and discard the encoding attribute
            var qp = line.indexOf('ENCODING=QUOTED-PRINTABLE');
            if(qp != -1){
                line = line.substr(0,qp) + this.decodeQP(line.substr(qp+25));
            }

            function finalizeKeyOrAttr() {
                if(key) {
                    if(attrKey) {
                        attrs[attrKey] = tmp.split(',');
                    } else {
                        //"Floating" attributes are probably vCard 2.1 TYPE or PREF values.
                        if(tmp == "PREF"){
                            attrs.PREF = 1;
                        } else {
                            if (attrs.TYPE) attrs.TYPE.push(tmp);
                            else attrs.TYPE = [tmp];
                        }
                    }
                } else {
                    key = tmp;
                }
            }

            for(var i in line) {
                var c = line[i];

                switch(c) {
                case ':':
                    finalizeKeyOrAttr();
                    value = line.slice(Number(i) + 1);
                    callback.apply(
                        this,
                        [key, value, attrs]
                    );
                    return;
                case ';':
                    finalizeKeyOrAttr();
                    tmp = '';
                    break;
                case '=':
                    attrKey = tmp;
                    tmp = '';
                    break;
                default:
                    tmp += c;
                }
            }
        },
        /** Quoted Printable Parser
          * 
          * Parses quoted-printable strings, which sometimes appear in 
          * vCard 2.1 files (usually the address field)
          * 
          * Code adapted from: 
          * https://github.com/andris9/mimelib
          *
        **/
        decodeQP: function(str){
            str = (str || "").toString();
            str = str.replace(/\=(?:\r?\n|$)/g, "");
            var str2 = "";
            for(var i=0, len = str.length; i<len; i++){
                chr = str.charAt(i);
                if(chr == "=" && (hex = str.substr(i+1, 2)) && /[\da-fA-F]{2}/.test(hex)){
                    str2 += String.fromCharCode(parseInt(hex,16));
                    i+=2;
                    continue;
                }
                str2 += chr;
            }
            return str2;
        }

    };

})();
  return {
      VCF: VCF,
      VCard: VCard
  };
});