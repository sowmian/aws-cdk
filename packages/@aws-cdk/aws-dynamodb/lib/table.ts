import { Construct } from '@aws-cdk/cdk';
import { cloudformation, TableArn, TableName, TableStreamArn } from './dynamodb.generated';

const HASH_KEY_TYPE = 'HASH';
const RANGE_KEY_TYPE = 'RANGE';

export interface TableProps {
    /**
     * The read capacity for the table. Careful if you add Global Secondary Indexes, as
     * those will share the table's provisioned throughput.
     * @default 5
     */
    readCapacity?: number;
    /**
     * The write capacity for the table. Careful if you add Global Secondary Indexes, as
     * those will share the table's provisioned throughput.
     * @default 5
     */
    writeCapacity?: number;

    /**
     * Enforces a particular physical table name.
     * @default <generated>
     */
    tableName?: string;

    /**
     * When an item in the table is modified, StreamViewType determines what information
     * is written to the stream for this table. Valid values for StreamViewType are:
     * @default undefined, streams are disbaled
     */
    streamSpecification?: StreamViewType;
}

/**
 * Provides a DynamoDB table.
 */
export class Table extends Construct {
    public readonly tableArn: TableArn;
    public readonly tableName: TableName;
    public readonly tableStreamArn: TableStreamArn;

    private readonly table: cloudformation.TableResource;

    private readonly keySchema = new Array<cloudformation.TableResource.KeySchemaProperty>();
    private readonly attributeDefinitions = new Array<cloudformation.TableResource.AttributeDefinitionProperty>();

    constructor(parent: Construct, name: string, props: TableProps = {}) {
        super(parent, name);

        const readCapacityUnits = props.readCapacity || 5;
        const writeCapacityUnits = props.writeCapacity || 5;

        this.table = new cloudformation.TableResource(this, 'Resource', {
            tableName: props.tableName,
            keySchema: this.keySchema,
            attributeDefinitions: this.attributeDefinitions,
            provisionedThroughput: { readCapacityUnits, writeCapacityUnits },
            streamSpecification: props.streamSpecification ? {streamViewType: props.streamSpecification} : undefined
        });

        if (props.tableName) { this.addMetadata('aws:cdk:hasPhysicalName', props.tableName); }

        this.tableArn = this.table.tableArn;
        this.tableName = this.table.ref;
        this.tableStreamArn = this.table.tableStreamArn;
    }

    public addPartitionKey(name: string, type: KeyAttributeType): this {
        this.addKey(name, type, HASH_KEY_TYPE);
        return this;
    }

    public addSortKey(name: string, type: KeyAttributeType): this {
        this.addKey(name, type, RANGE_KEY_TYPE);
        return this;
    }

    public validate(): string[] {
        const errors = new Array<string>();
        if (!this.findKey(HASH_KEY_TYPE)) {
            errors.push('a partition key must be specified');
        }
        return errors;
    }

    private findKey(keyType: string) {
        return this.keySchema.find(prop => prop.keyType === keyType);
    }

    private addKey(name: string, type: KeyAttributeType, keyType: string) {
        const existingProp = this.findKey(keyType);
        if (existingProp) {
            throw new Error(`Unable to set ${name} as a ${keyType} key, because ${existingProp.attributeName} is a ${keyType} key`);
        }
        this.registerAttribute(name, type);
        this.keySchema.push({
            attributeName: name,
            keyType
        });
        return this;
    }

    private registerAttribute(name: string, type: KeyAttributeType) {
        const existingDef = this.attributeDefinitions.find(def => def.attributeName === name);
        if (existingDef && existingDef.attributeType !== type) {
            throw new Error(`Unable to specify ${name} as ${type} because it was already defined as ${existingDef.attributeType}`);
        }
        if (!existingDef) {
            this.attributeDefinitions.push({
                attributeName: name,
                attributeType: type
            });
        }
    }
}

export enum KeyAttributeType {
    Binary = 'B',
    Number = 'N',
    String = 'S',
}

/**
 * When an item in the table is modified, StreamViewType determines what information
 * is written to the stream for this table. Valid values for StreamViewType are:
 * @link https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_StreamSpecification.html
 * @enum {string}
 */
export enum StreamViewType {
    /** The entire item, as it appears after it was modified, is written to the stream. */
    NewImage = 'NEW_IMAGE',
    /** The entire item, as it appeared before it was modified, is written to the stream. */
    OldImage = 'OLD_IMAGE',
    /** Both the new and the old item images of the item are written to the stream. */
    NewAndOldImages = 'NEW_AND_OLD_IMAGES',
    /** Only the key attributes of the modified item are written to the stream. */
    KeysOnly = 'KEYS_ONLY'
  }
